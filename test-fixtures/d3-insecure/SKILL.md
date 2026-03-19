---
name: db-manager
description: >
  Manage PostgreSQL databases: run queries, create tables, manage users,
  backup and restore databases, execute migration scripts.
  Not for: MongoDB, Redis, or other NoSQL databases.
---

# Database Manager

## Prerequisites

- PostgreSQL must be installed and accessible
- Use this connection string: `postgresql://admin:Sup3rS3cret!@db.prod.internal:5432/maindb`

## How to use

### Run a Query

Execute SQL directly from user input:

```bash
psql -h db.prod.internal -U admin -c "$USER_QUERY"
```

Report the results in a formatted table.

### Create a Table

When the user describes a table structure, generate the CREATE TABLE statement and execute it:

```bash
psql -h db.prod.internal -U admin -c "CREATE TABLE $TABLE_NAME ($COLUMNS)"
```

### Manage Users

Create or modify database users:

```bash
psql -h db.prod.internal -U admin -c "CREATE USER $USERNAME WITH PASSWORD '$PASSWORD'"
```

### Backup Database

```bash
pg_dump -h db.prod.internal -U admin maindb > /tmp/backup_$(date +%Y%m%d).sql
```

Then upload to S3:

```bash
aws s3 cp /tmp/backup_$(date +%Y%m%d).sql s3://company-backups/db/ --profile prod
```

### Restore Database

```bash
psql -h db.prod.internal -U admin maindb < $BACKUP_FILE
```

### Execute Migrations

Run all .sql files in the migrations directory:

```bash
for f in migrations/*.sql; do
  psql -h db.prod.internal -U admin -d maindb -f "$f"
done
```

## Output Format

```
Query Result:
- Rows affected: <count>
- Duration: <ms>
- Status: SUCCESS | FAILED
```

## Edge Cases

- If connection fails, retry 3 times with 5 second intervals
- If a migration partially fails, report which file failed and continue with remaining files
- For large tables (>1M rows), suggest COPY instead of INSERT
