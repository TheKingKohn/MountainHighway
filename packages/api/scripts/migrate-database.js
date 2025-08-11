#!/usr/bin/env node

/**
 * Database Migration Script for Mountain Highway Marketplace
 * 
 * This script handles database migrations for both SQLite (development) 
 * and PostgreSQL (production) environments.
 * 
 * Usage:
 *   node scripts/migrate-database.js [command] [options]
 * 
 * Commands:
 *   generate  - Generate a new migration
 *   deploy    - Deploy pending migrations
 *   reset     - Reset database (development only)
 *   status    - Show migration status
 *   backup    - Create database backup
 *   restore   - Restore from backup
 * 
 * Options:
 *   --name <name>     - Migration name (for generate command)
 *   --file <path>     - Backup file path (for restore command)
 *   --force           - Force operation (dangerous!)
 *   --preview         - Show what would be done without executing
 * 
 * Examples:
 *   node scripts/migrate-database.js status
 *   node scripts/migrate-database.js generate --name "add_user_roles"
 *   node scripts/migrate-database.js deploy
 *   node scripts/migrate-database.js backup
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Load environment variables
require('dotenv').config();

const DATABASE_PROVIDER = process.env.DATABASE_PROVIDER || 'sqlite';
const DATABASE_URL = process.env.DATABASE_URL;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

class DatabaseMigrator {
  constructor() {
    this.validateEnvironment();
  }

  validateEnvironment() {
    if (!DATABASE_URL) {
      this.error('DATABASE_URL environment variable is required');
      process.exit(1);
    }

    if (!['sqlite', 'postgresql'].includes(DATABASE_PROVIDER)) {
      this.error(`Unsupported DATABASE_PROVIDER: ${DATABASE_PROVIDER}`);
      process.exit(1);
    }

    this.log(`Database Provider: ${DATABASE_PROVIDER}`, 'blue');
    this.log(`Environment: ${IS_PRODUCTION ? 'production' : 'development'}`, 'blue');
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  error(message) {
    console.error(`${colors.red}${colors.bold}Error: ${message}${colors.reset}`);
  }

  success(message) {
    console.log(`${colors.green}${colors.bold}✓ ${message}${colors.reset}`);
  }

  warning(message) {
    console.log(`${colors.yellow}${colors.bold}⚠ ${message}${colors.reset}`);
  }

  async confirm(message) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(`${colors.yellow}${message} (y/N): ${colors.reset}`, (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }

  execPrisma(command, options = {}) {
    // Use provider-specific schema file if available
    let schemaArg = '';
    if (DATABASE_PROVIDER === 'postgresql') {
      const postgresSchema = path.join(__dirname, '..', 'prisma', 'schema.postgresql.prisma');
      if (require('fs').existsSync(postgresSchema)) {
        schemaArg = ` --schema=${postgresSchema}`;
      }
    }
    
    const cmd = `npx prisma ${command}${schemaArg}`;
    this.log(`Executing: ${cmd}`, 'cyan');
    
    if (options.preview) {
      this.log('Preview mode - command not executed', 'yellow');
      return;
    }

    try {
      const result = execSync(cmd, { 
        stdio: 'inherit', 
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, ...options.env }
      });
      return result;
    } catch (error) {
      this.error(`Failed to execute: ${cmd}`);
      throw error;
    }
  }

  async status() {
    this.log('Checking migration status...', 'blue');
    
    try {
      this.execPrisma('migrate status');
      this.success('Migration status retrieved successfully');
    } catch (error) {
      this.error('Failed to get migration status');
      process.exit(1);
    }
  }

  async generate(migrationName) {
    if (!migrationName) {
      this.error('Migration name is required. Use --name <name>');
      process.exit(1);
    }

    this.log(`Generating migration: ${migrationName}`, 'blue');
    
    try {
      this.execPrisma(`migrate dev --name "${migrationName}" --create-only`);
      this.success(`Migration "${migrationName}" generated successfully`);
      this.log('Review the generated migration file before deploying', 'yellow');
    } catch (error) {
      this.error('Failed to generate migration');
      process.exit(1);
    }
  }

  async deploy(options = {}) {
    this.log('Deploying pending migrations...', 'blue');

    if (IS_PRODUCTION) {
      this.warning('Running in production environment');
      const confirmed = await this.confirm('Are you sure you want to deploy migrations to production?');
      if (!confirmed) {
        this.log('Migration cancelled by user', 'yellow');
        return;
      }
    }

    try {
      if (DATABASE_PROVIDER === 'sqlite') {
        this.execPrisma('migrate dev', options);
      } else {
        this.execPrisma('migrate deploy', options);
      }
      this.success('Migrations deployed successfully');
    } catch (error) {
      this.error('Failed to deploy migrations');
      process.exit(1);
    }
  }

  async reset(options = {}) {
    if (IS_PRODUCTION) {
      this.error('Database reset is not allowed in production environment');
      process.exit(1);
    }

    this.warning('This will delete all data and reset the database');
    const confirmed = await this.confirm('Are you sure you want to reset the database?');
    
    if (!confirmed) {
      this.log('Database reset cancelled by user', 'yellow');
      return;
    }

    this.log('Resetting database...', 'blue');
    
    try {
      this.execPrisma('migrate reset --force', options);
      this.success('Database reset successfully');
    } catch (error) {
      this.error('Failed to reset database');
      process.exit(1);
    }
  }

  async backup(options = {}) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let backupPath;

    if (DATABASE_PROVIDER === 'sqlite') {
      const dbPath = DATABASE_URL.replace('file:', '');
      backupPath = `backup-${timestamp}.db`;
      
      this.log('Creating SQLite backup...', 'blue');
      
      if (!options.preview) {
        fs.copyFileSync(dbPath, backupPath);
      }
    } else {
      // PostgreSQL backup using pg_dump
      backupPath = `backup-${timestamp}.sql`;
      const cmd = `pg_dump "${DATABASE_URL}" > ${backupPath}`;
      
      this.log('Creating PostgreSQL backup...', 'blue');
      
      if (!options.preview) {
        execSync(cmd);
      }
    }

    this.success(`Backup created: ${backupPath}`);
    return backupPath;
  }

  async restore(backupFile, options = {}) {
    if (!backupFile) {
      this.error('Backup file path is required. Use --file <path>');
      process.exit(1);
    }

    if (!fs.existsSync(backupFile)) {
      this.error(`Backup file not found: ${backupFile}`);
      process.exit(1);
    }

    this.warning(`This will restore database from: ${backupFile}`);
    this.warning('All current data will be lost');
    
    const confirmed = await this.confirm('Are you sure you want to restore from backup?');
    if (!confirmed) {
      this.log('Restore cancelled by user', 'yellow');
      return;
    }

    this.log('Restoring database...', 'blue');

    if (DATABASE_PROVIDER === 'sqlite') {
      const dbPath = DATABASE_URL.replace('file:', '');
      
      if (!options.preview) {
        fs.copyFileSync(backupFile, dbPath);
      }
    } else {
      // PostgreSQL restore using psql
      const cmd = `psql "${DATABASE_URL}" < ${backupFile}`;
      
      if (!options.preview) {
        execSync(cmd);
      }
    }

    this.success('Database restored successfully');
  }

  async validateConnection() {
    this.log('Validating database connection...', 'blue');
    
    try {
      // Use schema format validation instead of db push --preview
      this.execPrisma('format');
      this.success('Database schema is valid');
      
      // Try to run migration status to test connection
      this.log('Testing database connection...', 'blue');
      this.execPrisma('migrate status');
      this.success('Database connection is valid');
    } catch (error) {
      this.error('Database connection or schema validation failed');
      
      if (DATABASE_PROVIDER === 'postgresql') {
        this.log('Common PostgreSQL issues:', 'yellow');
        this.log('1. Check if PostgreSQL server is running', 'yellow');
        this.log('2. Verify connection string format', 'yellow');
        this.log('3. Ensure database exists', 'yellow');
        this.log('4. Check user permissions', 'yellow');
        this.log('5. Check firewall settings', 'yellow');
      } else {
        this.log('Common SQLite issues:', 'yellow');
        this.log('1. Check file path permissions', 'yellow');
        this.log('2. Ensure directory exists', 'yellow');
        this.log('3. Verify disk space available', 'yellow');
      }
      
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const options = {
    preview: args.includes('--preview'),
    force: args.includes('--force')
  };

  // Extract named options
  const nameIndex = args.indexOf('--name');
  const name = nameIndex >= 0 ? args[nameIndex + 1] : null;
  
  const fileIndex = args.indexOf('--file');
  const file = fileIndex >= 0 ? args[fileIndex + 1] : null;

  const migrator = new DatabaseMigrator();

  switch (command) {
    case 'status':
      await migrator.status();
      break;
      
    case 'generate':
      await migrator.generate(name);
      break;
      
    case 'deploy':
      await migrator.deploy(options);
      break;
      
    case 'reset':
      await migrator.reset(options);
      break;
      
    case 'backup':
      await migrator.backup(options);
      break;
      
    case 'restore':
      await migrator.restore(file, options);
      break;
      
    case 'validate':
      await migrator.validateConnection();
      break;
      
    default:
      console.log(`
${colors.bold}Mountain Highway Database Migration Tool${colors.reset}

Usage: node scripts/migrate-database.js [command] [options]

Commands:
  ${colors.green}status${colors.reset}                    Show migration status
  ${colors.green}generate${colors.reset} --name <name>    Generate new migration
  ${colors.green}deploy${colors.reset}                    Deploy pending migrations
  ${colors.green}reset${colors.reset}                     Reset database (dev only)
  ${colors.green}backup${colors.reset}                    Create database backup
  ${colors.green}restore${colors.reset} --file <path>     Restore from backup
  ${colors.green}validate${colors.reset}                  Test database connection

Options:
  ${colors.cyan}--name <name>${colors.reset}     Migration name (for generate)
  ${colors.cyan}--file <path>${colors.reset}     Backup file path (for restore)
  ${colors.cyan}--force${colors.reset}           Force operation
  ${colors.cyan}--preview${colors.reset}         Show what would be done

Examples:
  ${colors.yellow}node scripts/migrate-database.js status${colors.reset}
  ${colors.yellow}node scripts/migrate-database.js generate --name "add_user_roles"${colors.reset}
  ${colors.yellow}node scripts/migrate-database.js deploy${colors.reset}
  ${colors.yellow}node scripts/migrate-database.js backup${colors.reset}

Current Configuration:
  Database Provider: ${colors.bold}${DATABASE_PROVIDER}${colors.reset}
  Environment: ${colors.bold}${IS_PRODUCTION ? 'production' : 'development'}${colors.reset}
      `);
      break;
  }
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error(`${colors.red}${colors.bold}Unhandled error:${colors.reset}`, error);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error(`${colors.red}${colors.bold}Script failed:${colors.reset}`, error);
    process.exit(1);
  });
}

module.exports = DatabaseMigrator;
