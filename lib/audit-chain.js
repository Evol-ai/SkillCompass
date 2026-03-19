/**
 * audit-chain.js — Hash-chain Audit Log Class
 * 
 * Implements tamper-proof audit log using hash-chain technology
 * Each record's hash contains the previous record's hash, forming a chain
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

class AuditChain {
  constructor(skillName) {
    this.skillName = skillName;
    this.skillCompassDir = '.skill-compass';
    this.auditFile = path.join(this.skillCompassDir, skillName, 'audit.jsonl');
    
    // Ensure directory exists
    const auditDir = path.dirname(this.auditFile);
    if (!fs.existsSync(auditDir)) {
      fs.mkdirSync(auditDir, { recursive: true });
    }
  }

  /**
   * Log audit event
   * @param {Object} event - Event object
   * @param {string} event.type - Event type ('pre_scan' | 'eval' | 'improve' | 'rollback' | 'gate_trigger' | 'output_guard')
   * @param {string} event.severity - Severity ('INFO' | 'WARN' | 'HIGH' | 'CRITICAL')
   * @param {string} event.skillHash - Skill file hash value
   * @param {Array} event.findings - List of found issues
   * @param {string} event.message - Event description
   * @returns {Object} Generated audit entry
   */
  log(event) {
    const timestamp = new Date().toISOString();
    const previousHash = this._getLastHash();
    
    // Create audit entry (without hash)
    const entry = {
      timestamp,
      type: event.type,
      severity: event.severity,
      skillHash: event.skillHash,
      findings: event.findings || [],
      message: event.message,
      previousHash,
      entryId: crypto.randomUUID()
    };
    
    // Calculate hash for current entry
    const entryContent = JSON.stringify({
      ...entry,
      // Don't include entryHash itself
    });
    entry.entryHash = crypto.createHash('sha256')
      .update(entryContent + (previousHash || ''))
      .digest('hex');
    
    // Write to audit log
    try {
      fs.appendFileSync(this.auditFile, JSON.stringify(entry) + '\n');
      
      // Output CRITICAL events to stderr
      if (event.severity === 'CRITICAL') {
        console.error(`[AUDIT CRITICAL] ${this.skillName}: ${event.message}`);
        console.error(`[AUDIT] Full details in ${this.auditFile}`);
      }
      
      return entry;
    } catch (error) {
      console.error(`Failed to write audit log: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify audit chain integrity
   * @returns {Object} Validation result
   */
  verify() {
    try {
      const entries = this._readAllEntries();
      
      if (entries.length === 0) {
        return { valid: true, entries: 0 };
      }
      
      let previousHash = null;
      
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        
        // Verify previousHash
        if (entry.previousHash !== previousHash) {
          return {
            valid: false,
            entries: entries.length,
            tamperedAt: entry.timestamp,
            reason: `Hash chain broken at entry ${i}: expected previousHash '${previousHash}', got '${entry.previousHash}'`
          };
        }
        
        // Recalculate and verify entryHash
        const entryContent = JSON.stringify({
          timestamp: entry.timestamp,
          type: entry.type,
          severity: entry.severity,
          skillHash: entry.skillHash,
          findings: entry.findings,
          message: entry.message,
          previousHash: entry.previousHash,
          entryId: entry.entryId
        });
        
        const expectedHash = crypto.createHash('sha256')
          .update(entryContent + (previousHash || ''))
          .digest('hex');
        
        if (entry.entryHash !== expectedHash) {
          return {
            valid: false,
            entries: entries.length,
            tamperedAt: entry.timestamp,
            reason: `Entry hash mismatch at entry ${i}: expected '${expectedHash}', got '${entry.entryHash}'`
          };
        }
        
        previousHash = entry.entryHash;
      }
      
      return { valid: true, entries: entries.length };
      
    } catch (error) {
      return {
        valid: false,
        entries: 0,
        reason: `Verification failed: ${error.message}`
      };
    }
  }

  /**
   * Get history
   * @param {string} since - Optional time filter (ISO string)
   * @returns {Array} Array of audit entries
   */
  getHistory(since = null) {
    const entries = this._readAllEntries();
    
    if (!since) {
      return entries;
    }
    
    const sinceDate = new Date(since);
    return entries.filter(entry => new Date(entry.timestamp) >= sinceDate);
  }

  /**
   * Get statistics
   * @returns {Object} Statistics data
   */
  getStats() {
    const entries = this._readAllEntries();
    const stats = {
      totalEntries: entries.length,
      firstEntry: entries.length > 0 ? entries[0].timestamp : null,
      lastEntry: entries.length > 0 ? entries[entries.length - 1].timestamp : null,
      severityBreakdown: {},
      typeBreakdown: {}
    };
    
    entries.forEach(entry => {
      stats.severityBreakdown[entry.severity] = (stats.severityBreakdown[entry.severity] || 0) + 1;
      stats.typeBreakdown[entry.type] = (stats.typeBreakdown[entry.type] || 0) + 1;
    });
    
    return stats;
  }

  /**
   * Private method: Read all audit entries
   * @returns {Array} Array of audit entries
   */
  _readAllEntries() {
    if (!fs.existsSync(this.auditFile)) {
      return [];
    }
    
    const content = fs.readFileSync(this.auditFile, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.length > 0);
    
    return lines.map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSON at line ${index + 1}: ${error.message}`);
      }
    });
  }

  /**
   * Private method: Get hash of the last record
   * @returns {string|null} Hash value of the last record
   */
  _getLastHash() {
    const entries = this._readAllEntries();
    return entries.length > 0 ? entries[entries.length - 1].entryHash : null;
  }
}

module.exports = { AuditChain };