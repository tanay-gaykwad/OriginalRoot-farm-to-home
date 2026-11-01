# OriginalRoot Phase 6: named operators and accountable actions

## Goal

Replace the shared operator key as routine access with individual operator accounts, role-gated account provisioning, and an attributed local activity history. Keep the bootstrap secret only for creating the first owner account.

## Included

- One-time owner setup protected by the configured `OriginalRoot_OPERATOR_TOKEN` bootstrap key.
- Individual operator sign-in/sign-out and seven-day HTTP-only, SameSite=Strict sessions; sessions are stored as token hashes.
- Salted PBKDF2-HMAC-SHA256 password hashes; password changes require the current password and revoke the user's other sessions.
- Owner-only creation of additional operator accounts. Review and order actions are available to owner and operator roles.
- Removal of direct bearer-key access to review, order, and passport endpoints; they now require an operator session.
- Local audit history for owner/operator creation, password changes, offer decisions, order status changes, and passport checkpoints.
- Passport entries identify the operator display name that recorded them.

## First operator setup

1. Set a strong `OriginalRoot_OPERATOR_TOKEN` in `.env` and run `docker compose up --build -d`.
2. Open the Operations view and enter the bootstrap key once to create the owner username and password.
3. Sign in later with that individual account. The bootstrap key is not accepted for ongoing operations.
4. The owner can provision staff accounts and each operator should change their password after receiving it.

If the owner account is lost, do not reset the SQLite database because that would remove offers, orders, and passports. A controlled recovery procedure is not implemented yet; make a database backup before attempting manual recovery.

## API

- `GET /api/operator/setup-status` reports whether first setup is pending and whether the bootstrap key is configured.
- `POST /api/operator/bootstrap` creates the first owner using `bootstrap_key`, `full_name`, `username`, and a 12+ character password.
- `POST /api/operator/login`, `POST /api/operator/logout`, and `GET /api/operator/me` manage operator sessions.
- `POST /api/operator/password` changes the signed-in account password and revokes its other sessions.
- `GET /api/operator/users` and `POST /api/operator/users` are owner-only; new accounts receive the `operator` role.
- `GET /api/operator/audit` returns the latest 100 action records to signed-in operators.
- Existing offer review, order management, batch listing, and checkpoint routes require the operator session cookie.

## Limits

The audit history is stored in the same SQLite file as application data. A local database administrator can alter it, and there is no remote backup or tamper-evidence chain. Account suspension, owner recovery, multi-factor authentication, rate limiting, and internet deployment are not provided. Keep OriginalRoot on loopback; a public deployment needs HTTPS, secure cookies, hardened session and CSRF handling, backups, credential recovery, staff offboarding, and an independent security review.

