---
name: node-project-setup
version: 1.0.0
description: >
  Helps set up new Node.js projects with best practices.
  Includes package.json creation, dependency installation, and basic structure.
  Not for: React/Vue setup, deployment, or Docker configuration.
commands:
  - setup-node-project
---

# Node.js Project Setup

This skill helps create well-structured Node.js projects with modern best practices.

## Features

- Automatic package.json generation
- Common dependency installation
- Project structure creation
- Basic configuration files

## Setup Process

The skill will execute these steps:

### 1. Initialize Project

```bash
npm init -y
```

### 2. Install Common Dependencies

```bash
npm install express dotenv
npm install --save-dev jest nodemon eslint
```

### 3. Project Structure

Creates the following directories:
- `src/` - Source code
- `tests/` - Test files  
- `docs/` - Documentation

### 4. Configuration Files

Example `.gitignore`:
```
node_modules/
.env
*.log
dist/
```

Example `package.json` scripts:
```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js", 
    "test": "jest"
  }
}
```

## API Integration Example

For projects requiring external APIs:

```javascript
// Example API call (user confirms endpoint)
const response = await fetch('https://api.github.com/users/octocat');
const data = await response.json();
```

## Requirements

- Node.js 16+ installed
- npm or yarn package manager
- Write access to project directory