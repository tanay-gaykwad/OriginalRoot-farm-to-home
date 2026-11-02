# OriginalRoot Phase 14: customer accounts and private order history

## Included

- Customer signup and sign-in use a salted PBKDF2 password hash, a random HTTP-only session cookie, and hashed session tokens in SQLite. Customers can explicitly sign out.
- The customer workspace shows only orders attached to the signed-in account, with status history and the order total. It does not return delivery addresses or customer contact details in the history response.
- Orders created while signed in are linked to that customer account and use the profile name and mobile number. Guest checkout remains available.
- Guest order tracking now requires both the order reference and the mobile number used at checkout. The former reference-only GET endpoint is limited to the signed-in owner of an account-linked order.
- Existing databases receive a nullable customer link; earlier guest orders stay guest orders and are not assigned to an account based on matching names or phone numbers.

## Account and data boundaries

Mobile numbers are collected as account/order contact details but are **not verified** by SMS or OTP. Account recovery, phone changes, account deletion, payments, refunds, and multi-device production security operations are not included. Customer data remains in the local SQLite database and should be protected with the host's disk access controls and backups. Set `OriginalRoot_COOKIE_SECURE=1` when serving over HTTPS; keep the service private until production hosting, rate limiting, monitoring, and recovery procedures are configured.

The API never stores customer passwords in plaintext. The application does not provide an account recovery path, so users must retain their credentials until recovery is implemented.

## Next phase

Add customer self-service order cancellation rules, profile and consent controls, credential recovery, and operational safeguards for a hosted service. Then validate the full customer-to-grower workflow in a single supply corridor before public ordering.
