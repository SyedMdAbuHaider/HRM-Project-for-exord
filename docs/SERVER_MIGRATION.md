# Exord HRM — Server-Owned Migration

## Objective

Move Exord HRM from a Supabase-dependent application to a server-owned platform.

Target architecture:

Android / Web -> HTTPS / WebSocket -> HRM API -> PostgreSQL
                                      -> Redis
                                      -> background workers
                                      -> private file storage
                                      -> email / push providers

PostgreSQL becomes the authoritative system of record. Clients never connect directly to PostgreSQL.

## Migration rules

1. Do not delete Supabase until the replacement module is live and verified.
2. No new frontend feature should add a dependency on Supabase.
3. Business rules belong on the server, not in the browser/APK.
4. Authentication, authorization, audit logging, validation and transactions are server responsibilities.
5. Attendance, payroll and finalized financial records require idempotency and immutable audit history.
6. Production secrets must never be committed to Git.
7. The existing application remains the compatibility client during migration.

## Supabase replacement map

| Supabase capability | Server-owned replacement |
|---|---|
| Auth | HRM Auth service + PostgreSQL sessions/tokens |
| Postgres | Self-hosted PostgreSQL |
| Row Level Security | API authorization + service-layer policies |
| RPC | PostgreSQL functions or typed service methods |
| Realtime | WebSocket gateway |
| Broadcast | WebSocket events |
| Storage | Private object/file storage behind authorized API |
| Edge Functions | HRM workers/background jobs |
| Email functions | Server mail service / worker |
| Database migrations | Versioned SQL migrations |
| Audit/security rules | Server audit log + DB constraints |

## Module migration order

1. Infrastructure and configuration
2. Database schema and migrations
3. Authentication and sessions
4. Employees / departments / roles
5. Attendance
6. Leave and requests
7. Payroll / salary / loans
8. Files and documents
9. Notifications
10. Chat and realtime
11. Infrastructure monitoring
12. Android application
13. Remove Supabase dependencies

## Production safety

The migration branch is intentionally additive first. The existing Supabase path should remain operational until each replacement module passes functional and data-integrity tests.

Before production cutover:

- rotate every credential previously committed to the repository
- export and verify a complete Supabase backup
- import data into private PostgreSQL
- run row-count and checksum reconciliation
- test login, attendance, payroll, leave, files and chat
- test restore from backup
- perform a controlled cutover
- keep a rollback window

## Initial backend boundary

The current server.js and attendance-api.js are transitional services. They should eventually be consolidated into a single versioned API with workers and a shared database layer.

Recommended API namespaces:

- /api/v1/auth
- /api/v1/employees
- /api/v1/attendance
- /api/v1/leave
- /api/v1/payroll
- /api/v1/loans
- /api/v1/files
- /api/v1/chat
- /api/v1/notifications
- /api/v1/monitoring
- /api/v1/admin

Realtime events:

- chat.message
- chat.typing
- chat.read
- notification.created
- attendance.updated
- monitoring.alert

## Non-negotiable security model

- TLS at the edge
- PostgreSQL bound to private interfaces only
- Redis bound to private interfaces only
- per-user authentication
- role/permission checks on every protected operation
- request schema validation
- rate limiting
- audit logging
- file authorization before download
- password hashing with Argon2id
- short-lived access tokens
- rotating/revocable refresh sessions
- encrypted backups
- secret management through environment/runtime configuration
