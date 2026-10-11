---
id: nosql-and-operational-databases
title: NoSQL and operational databases (MongoDB, Cassandra, DynamoDB, Cosmos DB, Spanner, Bigtable, Redis, Postgres/Aurora/AlloyDB)
triggers:
  technologies: [postgresql, amazon-aurora, alloydb, cloud-sql, azure-sql-database, mysql, sql-server, ibm-db2, sybase-ase, oracle-database]
  roles: [source-database, application]
  keywords: [nosql, mongodb, cassandra, dynamodb, cosmos db, cosmosdb, spanner, bigtable, redis, oltp, operational database, key-value, document database, aurora, alloydb, replatform, latency, global distribution]
priority: 5
---

## Start from access patterns, not product names
For each application capture: read/write ratio, peak operations per second, latency SLO (p99), item/row size, query patterns (point lookups, range scans, ad-hoc joins), consistency needs, transactions spanning entities, and geographic distribution. The right target falls out of these.

## Heuristics
- **Relational with joins and transactions, single region**: managed PostgreSQL/MySQL (Cloud SQL, AlloyDB, Aurora, Azure Database for PostgreSQL/MySQL) or Azure SQL / SQL Server. Default choice for most line-of-business apps.
- **Relational at global scale with strong consistency**: Spanner, CockroachDB, or Aurora DSQL-style offerings (verify current availability); higher cost and schema design discipline (avoid hotspotting keys).
- **Document model, flexible schema**: MongoDB Atlas, Cosmos DB (NoSQL or MongoDB API — check compatibility level for your driver features), DocumentDB (MongoDB-compatible; verify API coverage).
- **Massive key-value / wide-column, predictable access**: DynamoDB, Bigtable, Cassandra (Keyspaces, Astra, managed Cassandra on Azure). Design tables around queries; ad-hoc querying is poor.
- **Caching/session/leaderboards**: Redis/Valkey managed services (ElastiCache, Memorystore, Azure Cache for Redis). Treat as a cache unless persistence guarantees are explicitly designed. Check current licensing of Redis vs Valkey forks.
- PostgreSQL-compatible engines differ in extensions, replication and performance features (AlloyDB columnar engine, Aurora storage) — verify extension support for your app.

## Migration approaches
- **Like-for-like** (MongoDB → Atlas, Cassandra → managed Cassandra, Postgres → managed Postgres): native replication/dump-restore or vendor live-migration tools; lowest risk.
- **Cross-model** (Mongo → DynamoDB, Cassandra → Bigtable, Oracle → Spanner): application rewrite of the data access layer; treat as a refactor project with dual reads/writes or CDC plus a validation phase.
- Use CDC or native change streams (MongoDB change streams, DynamoDB Streams, Cosmos DB change feed) for low-downtime moves and to feed analytics.

## Pitfalls
- Partition/shard key chosen without looking at hot keys; throttling under peak.
- Provisioned throughput (RU/s, WCU/RCU, nodes) sized from averages; size from p99 and peak.
- Assuming API-compatible services are fully compatible (aggregation operators, transactions, indexes differ).
- Running analytics directly on the operational store; replicate to the lakehouse/warehouse instead.
- Connection storms from serverless functions; use connection pooling/proxies.

## Validation
Record counts per collection/table, document/row hashes for samples and critical entities, index and TTL parity, and load tests replaying production traffic at peak plus headroom. Track p99 latency, not averages.

## What to ask
Access patterns, SLOs, data size and growth, multi-region and DR needs, consistency model, current licences, team operating skills, and whether the application code can change.

## Red flags
- Choosing NoSQL "for scale" for a small relational app with complex joins.
- No load test before cutover.
- Global distribution promised without understanding conflict resolution and latency costs.
