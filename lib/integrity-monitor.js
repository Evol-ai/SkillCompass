/**
 * integrity-monitor.js — File Integrity Monitor
 * 
 * Monitor critical files in .skill-compass directory, detect unauthorized modifications
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

class IntegrityMonitor {
  constructor(skillName) {
    this.skillName = skillName;
    this.skillCompassDir = '.skill-compass';
    this.skillDir = path.join(this.skillCompassDir, skillName);
    this.checksumsFile = path.join(this.skillDir, '.checksums');
    
    // List of tracked files
    this.trackedFiles = [
      'manifest.json',
      'corrections.json',
      'audit.jsonl'
    ];
    
    // Ensure directory exists
    if (!fs.existsSync(this.skillDir)) {
      fs.mkdirSync(this.skillDir, { recursive: true });
    }
  }

  /**
   * Create snapshot of current files
   */
  snapshot() {
    const checksums = {};
    const timestamp = new Date().toISOString();
    
    // Calculate checksums for base files
    for (const filename of this.trackedFiles) {
      const filePath = path.join(this.skillDir, filename);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        checksums[filename] = {
          sha256: crypto.createHash('sha256').update(content).digest('hex'),
          size: content.length,
          mtime: fs.statSync(filePath).mtime.toISOString()
        };
      }
    }
    
    // Process snapshots directory
    const snapshotsDir = path.join(this.skillDir, 'snapshots');
    if (fs.existsSync(snapshotsDir)) {
      const snapshotFiles = fs.readdirSync(snapshotsDir).filter(f => f.endsWith('.md'));
      checksums._snapshots = {};
      
      for (const snapFile of snapshotFiles) {
        const snapPath = path.join(snapshotsDir, snapFile);
        const content = fs.readFileSync(snapPath, 'utf-8');
        checksums._snapshots[snapFile] = {
          sha256: crypto.createHash('sha256').update(content).digest('hex'),
          size: content.length,
          mtime: fs.statSync(snapPath).mtime.toISOString()
        };
      }
    }
    
    // Save checksums file
    const checksumsData = {
      version: '1.0',
      skillName: this.skillName,
      timestamp,
      checksums
    };
    
    try {
      fs.writeFileSync(this.checksumsFile, JSON.stringify(checksumsData, null, 2));
      return checksums;
    } catch (error) {
      throw new Error(`Failed to write checksums: ${error.message}`);
    }
  }

  /**
   * Verify file integrity
   * @returns {Object} Validation result
   */
  verify() {
    if (!fs.existsSync(this.checksumsFile)) {
      return {
        valid: false,
        reason: 'No baseline checksums found',
        drifts: []
      };
    }
    
    let baseline;
    try {
      const checksumsContent = fs.readFileSync(this.checksumsFile, 'utf-8');
      baseline = JSON.parse(checksumsContent);
    } catch (error) {
      return {
        valid: false,
        reason: `Failed to read checksums: ${error.message}`,
        drifts: []
      };
    }
    
    const drifts = [];
    
    // Verify base files
    for (const filename of this.trackedFiles) {
      const filePath = path.join(this.skillDir, filename);
      const baselineInfo = baseline.checksums[filename];
      
      if (!baselineInfo) {
        // File doesn't exist in baseline but exists now
        if (fs.existsSync(filePath)) {
          drifts.push({
            file: filename,
            type: 'added',
            expected: null,
            actual: 'file exists'
          });
        }
        continue;
      }
      
      if (!fs.existsSync(filePath)) {
        drifts.push({
          file: filename,
          type: 'deleted',
          expected: baselineInfo.sha256,
          actual: null
        });
        continue;
      }
      
      // Verify file content
      const content = fs.readFileSync(filePath, 'utf-8');
      const currentHash = crypto.createHash('sha256').update(content).digest('hex');
      
      if (currentHash !== baselineInfo.sha256) {
        drifts.push({
          file: filename,
          type: 'modified',
          expected: baselineInfo.sha256,
          actual: currentHash
        });
      }
    }
    
    // Verify snapshot files
    const snapshotsDir = path.join(this.skillDir, 'snapshots');
    const baselineSnapshots = baseline.checksums._snapshots || {};
    
    if (fs.existsSync(snapshotsDir)) {
      const currentSnapshots = fs.readdirSync(snapshotsDir).filter(f => f.endsWith('.md'));
      
      for (const snapFile of currentSnapshots) {
        const snapPath = path.join(snapshotsDir, snapFile);
        const baselineInfo = baselineSnapshots[snapFile];
        
        if (!baselineInfo) {
          drifts.push({
            file: `snapshots/${snapFile}`,
            type: 'added',
            expected: null,
            actual: 'file exists'
          });
          continue;
        }
        
        const content = fs.readFileSync(snapPath, 'utf-8');
        const currentHash = crypto.createHash('sha256').update(content).digest('hex');
        
        if (currentHash !== baselineInfo.sha256) {
          drifts.push({
            file: `snapshots/${snapFile}`,
            type: 'modified',
            expected: baselineInfo.sha256,
            actual: currentHash
          });
        }
      }
      
      // Check deleted snapshots
      for (const snapFile of Object.keys(baselineSnapshots)) {
        if (!currentSnapshots.includes(snapFile)) {
          drifts.push({
            file: `snapshots/${snapFile}`,
            type: 'deleted',
            expected: baselineSnapshots[snapFile].sha256,
            actual: null
          });
        }
      }
    }
    
    return {
      valid: drifts.length === 0,
      drifts,
      baseline: {
        timestamp: baseline.timestamp,
        fileCount: Object.keys(baseline.checksums).length
      }
    };
  }

  /**
   * Attempt to repair found drifts
   * @param {Array} drifts - List of drifts found during verification
   * @returns {Object} Repair result
   */
  repair(drifts) {
    const repaired = [];
    const failed = [];
    
    for (const drift of drifts) {
      try {
        if (drift.file === 'manifest.json' && drift.type === 'modified') {
          // For manifest.json modifications, try to recover from audit log
          const recovered = this._recoverFromAudit('manifest.json');
          if (recovered) {
            repaired.push(drift.file);
          } else {
            failed.push({ file: drift.file, reason: 'No recovery data in audit log' });
          }
        } else if (drift.file === 'corrections.json' && drift.type === 'modified') {
          // For corrections.json modifications, try to recover from audit log
          const recovered = this._recoverFromAudit('corrections.json');
          if (recovered) {
            repaired.push(drift.file);
          } else {
            failed.push({ file: drift.file, reason: 'No recovery data in audit log' });
          }
        } else {
          // Other types of drifts cannot be automatically repaired for now
          failed.push({ file: drift.file, reason: 'Automatic repair not supported' });
        }
      } catch (error) {
        failed.push({ file: drift.file, reason: error.message });
      }
    }
    
    return { repaired, failed };
  }

  /**
   * Private method: Recover file from audit log
   * @param {string} filename - Filename to recover
   * @returns {boolean} Whether recovery was successful
   */
  _recoverFromAudit(filename) {
    try {
      const { AuditChain } = require('./audit-chain.js');
      const auditChain = new AuditChain(this.skillName);
      const history = auditChain.getHistory();
      
      // Find recent relevant audit records
      const relevantEntries = history
        .filter(entry => entry.message && entry.message.includes(filename))
        .reverse(); // Most recent first
      
      if (relevantEntries.length === 0) {
        return false;
      }
      
      // Specific recovery logic should be implemented here
      // Since audit logs may not contain complete file content,
      // Actual implementation may require more complex recovery strategies
      console.warn(`Recovery for ${filename} not implemented - manual intervention required`);
      return false;
      
    } catch (error) {
      console.error(`Failed to recover ${filename}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get monitoring status
   * @returns {Object} Status information
   */
  getStatus() {
    const status = {
      skillName: this.skillName,
      baselineExists: fs.existsSync(this.checksumsFile),
      trackedFiles: this.trackedFiles.length,
      filesExist: {}
    };
    
    if (status.baselineExists) {
      try {
        const baseline = JSON.parse(fs.readFileSync(this.checksumsFile, 'utf-8'));
        status.baselineTimestamp = baseline.timestamp;
        status.baselineFileCount = Object.keys(baseline.checksums).length;
      } catch (error) {
        status.baselineError = error.message;
      }
    }
    
    // Check current file status
    for (const filename of this.trackedFiles) {
      const filePath = path.join(this.skillDir, filename);
      status.filesExist[filename] = fs.existsSync(filePath);
    }
    
    return status;
  }
}

module.exports = { IntegrityMonitor };