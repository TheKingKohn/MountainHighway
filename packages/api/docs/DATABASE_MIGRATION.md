# Database Migration Guide for Mountain Highway

This guide covers database setup, migration, and management for both development (SQLite) and production (PostgreSQL) environments.

## Quick Start

### Development Setup (SQLite)
```bash
# 1. Configure environment
cp .env.example .env
# Edit .env and set DATABASE_PROVIDER=sqlite

# 2. Run initial migration
node scripts/migrate-database.js deploy

# 3. Start the server
npm run dev
```

### Production Setup (PostgreSQL)
```bash
# 1. Configure environment
# Set DATABASE_PROVIDER=postgresql
# Set DATABASE_URL=postgresql://user:password@host:5432/database

# 2. Validate connection
node scripts/migrate-database.js validate

# 3. Deploy migrations
node scripts/migrate-database.js deploy

# 4. Start the server
npm start
```

## Environment Configuration

### Required Variables
```env
DATABASE_URL=file:./dev.db  # or postgresql://...
DATABASE_PROVIDER=sqlite    # or postgresql
```

### Optional Variables (PostgreSQL only)
```env
DATABASE_POOL_SIZE=10
DATABASE_POOL_TIMEOUT=20
```

## Migration Script Usage

The `scripts/migrate-database.js` script handles all database operations:

### Check Migration Status
```bash
node scripts/migrate-database.js status
```

### Generate New Migration
```bash
node scripts/migrate-database.js generate --name "add_user_roles"
```

### Deploy Migrations
```bash
# Development (applies and generates if needed)
node scripts/migrate-database.js deploy

# Production (applies only existing migrations)
NODE_ENV=production node scripts/migrate-database.js deploy
```

### Database Backup & Restore
```bash
# Create backup
node scripts/migrate-database.js backup

# Restore from backup
node scripts/migrate-database.js restore --file backup-2024-01-01T12-00-00-000Z.db
```

### Reset Database (Development Only)
```bash
node scripts/migrate-database.js reset
```

### Validate Connection
```bash
node scripts/migrate-database.js validate
```

## Database Schema Overview

### Core Tables
- **User**: User accounts and profiles
- **Listing**: Marketplace listings
- **Order**: Purchase transactions
- **Message**: User communications

### Key Relationships
- Users can have multiple Listings
- Users can have multiple Orders (as buyer)
- Listings can have multiple Orders
- Users can send/receive Messages

## Migration Best Practices

### Development Workflow
1. Make schema changes in `prisma/schema.prisma`
2. Generate migration: `node scripts/migrate-database.js generate --name "descriptive_name"`
3. Review generated SQL in `prisma/migrations/`
4. Apply migration: `node scripts/migrate-database.js deploy`
5. Test changes thoroughly

### Production Deployment
1. **Always backup first**: `node scripts/migrate-database.js backup`
2. **Test on staging**: Deploy to staging environment first
3. **Validate migration**: Use `--preview` flag to see what will happen
4. **Deploy during maintenance**: Schedule downtime if needed
5. **Monitor**: Check application health after deployment

### Migration Safety
- ✅ **Safe Operations**: Adding columns, indexes, new tables
- ⚠️ **Careful Operations**: Renaming columns, changing types
- ❌ **Dangerous Operations**: Dropping columns, tables with data

## Database Provider Switching

### SQLite → PostgreSQL
1. **Export data**: Create backup of SQLite database
2. **Set up PostgreSQL**: Install and configure PostgreSQL server
3. **Update environment**: Change `DATABASE_PROVIDER` and `DATABASE_URL`
4. **Deploy schema**: `node scripts/migrate-database.js deploy`
5. **Import data**: Use custom data migration script (manual process)

### PostgreSQL → SQLite (Not Recommended for Production)
1. **Export data**: Use `pg_dump` to export data
2. **Update environment**: Change to SQLite configuration
3. **Deploy schema**: `node scripts/migrate-database.js deploy`
4. **Import data**: Convert PostgreSQL dump to SQLite format

## Troubleshooting

### Common SQLite Issues
- **File permissions**: Ensure write access to database file and directory
- **Disk space**: Check available disk space
- **Concurrent access**: SQLite has limited concurrent write support

### Common PostgreSQL Issues
- **Connection refused**: Check if PostgreSQL service is running
- **Authentication failed**: Verify username/password in connection string
- **Database not found**: Ensure database exists before migration
- **SSL required**: Production environments often require SSL connections

### Migration Failures
1. **Check migration status**: `node scripts/migrate-database.js status`
2. **Review logs**: Check application and database logs
3. **Rollback if needed**: Restore from backup
4. **Fix issues**: Address schema or data conflicts
5. **Retry migration**: Run deploy command again

## Connection Validation

The system automatically validates database configuration on startup:

### Validation Checks
- ✅ Environment variables are set
- ✅ Connection string format is correct
- ✅ Database server is reachable
- ✅ Credentials are valid
- ✅ Schema is up to date

### Health Monitoring
Access `/api/health` endpoint to check:
- Database connection status
- Response latency
- Database version
- Migration status

## Performance Considerations

### SQLite Optimization
- Enable WAL mode for better concurrency
- Regular VACUUM operations
- Appropriate indexes on frequently queried columns

### PostgreSQL Optimization
- Connection pooling (configured via environment)
- Query optimization with EXPLAIN
- Regular ANALYZE for statistics updates
- Monitor slow query log

## Security Best Practices

### Connection Security
- ✅ Use SSL for PostgreSQL in production
- ✅ Restrict database user permissions
- ✅ Use strong passwords
- ✅ Enable connection logging
- ✅ Regular security updates

### Environment Security
- ✅ Never commit real credentials to git
- ✅ Use different credentials per environment
- ✅ Rotate credentials regularly
- ✅ Monitor database access logs

## Backup Strategy

### Automated Backups
- **Development**: Manual backups before major changes
- **Production**: Automated daily/hourly backups
- **Testing**: Regular backup before running tests

### Backup Verification
- Test restore procedures regularly
- Verify backup integrity
- Document restore procedures
- Practice disaster recovery

## Support Commands

### Database Information
```bash
# Check current provider and status
node -e "require('./src/config/database').checkDatabaseHealth().then(console.log)"

# List all tables
node -e "require('./src/config/database').getPrismaClient().\$queryRaw\`SELECT name FROM sqlite_master WHERE type='table'\`.then(console.log)"
```

### Reset Development Environment
```bash
# Complete reset (DESTRUCTIVE - development only)
rm -f dev.db*
node scripts/migrate-database.js deploy
```

## Getting Help

If you encounter issues:
1. Check this documentation
2. Review error messages carefully
3. Check database server logs
4. Validate environment configuration
5. Test with a fresh database

For additional support, check the Prisma documentation at https://www.prisma.io/docs/
