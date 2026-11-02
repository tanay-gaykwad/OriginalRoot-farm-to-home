# OriginalRoot Phase 5: grower-owned accounts and offers

## Goal

Replace the illustrative grower dashboard with an account-backed workspace. A grower signs in, submits an offer under their farm or collective profile, and can see the review outcome for their own offers.

## Included

- Local grower registration with farm/collective display name, unique username, and password.
- Passwords stored using per-account random salts and PBKDF2-HMAC-SHA256; plaintext passwords are never stored.
- Random session tokens with only their SHA-256 digests stored in SQLite. The browser receives an `HttpOnly`, `SameSite=Strict`, seven-day cookie.
- Sign-in, sign-out, current account, and account-scoped offer-list endpoints.
- Offers inherit their displayed farm name and grower ID from the signed-in account. Clients cannot submit an offer under another farm name.
- Grower workspace with pending, published, and rejected offer records, operator decisions, approved quantities, and agreed payout details.
- SQLite migration adds a nullable ownership column to existing harvest rows without deleting existing offer/order data.

## API

- `POST /api/grower/register` accepts `farm_name`, `username`, and a password of at least 12 characters.
- `POST /api/grower/login` accepts `username` and password.
- `POST /api/grower/logout` invalidates the current session.
- `GET /api/grower/me` returns the signed-in profile.
- `GET /api/grower/listings` returns only offers belonging to that profile.
- `POST /api/harvest-listings` now requires a signed-in grower; farm name and ownership come from the session.

## Local service and privacy boundary

Accounts and sessions live in the local SQLite database and are available only to this local app. Existing offers from before Phase 5 have no account owner and do not appear in any grower's private list. Password recovery, account deletion, field identity checks, and multi-factor authentication are not implemented. At the end of Phase 5, the operator workspace still used the local shared operator key; Phase 6 replaces that with named operator accounts.

This service remains local-only. Before internet deployment it needs HTTPS with secure cookies, origin/CSRF protections reviewed for the deployment, throttling, credential recovery and support, user deletion/retention controls, authenticated operator roles, backups, and a security review. A profile name is self-entered and does not prove farmer or farm identity.

## Acceptance criteria

- New growers can create an account and sign in after a restart.
- A valid session is required to submit or view private grower offers.
- Passwords and raw session tokens are not stored in the database.
- One grower cannot fetch another grower's pending or rejected offers through the grower endpoint.
- An offer's farm name and owner are derived from the authenticated profile.
- Sign-out invalidates the session and removes the browser cookie.
- Existing Phase 2–4 operator review, orders, and public batch passports continue to use their prior data.

