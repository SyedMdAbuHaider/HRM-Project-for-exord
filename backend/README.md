# Exord HRM Backend

This directory is the target boundary for the server-owned HRM platform.

## Responsibilities

- authentication and session management
- authorization and permissions
- HR/employee data
- attendance validation and synchronization
- leave and approval workflows
- payroll and loans
- file authorization
- notifications
- chat and realtime gateway
- infrastructure monitoring
- audit logging
- background jobs

## Design principle

The backend is authoritative. The browser and Android client are untrusted clients.

Do not place database credentials, privileged API keys, payroll rules, permission decisions or administrative secrets in frontend code.

## Transitional services

The repository currently contains server.js and attendance-api.js. They are being migrated into this backend boundary rather than remaining as separate production applications.
