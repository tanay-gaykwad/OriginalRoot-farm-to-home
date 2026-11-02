# OriginalRoot Phase 15: customer account security

## Included

- Customer sign-in is rate-limited to 10 failed attempts per source address in a 15-minute window. The limiter stores a one-way hash of the source address, not the address itself.
- A signed-in customer can change their password after confirming the current password. Passwords remain salted PBKDF2 hashes.
- Changing a password revokes the customer's other sessions and rotates the active session cookie.
- Database startup adds the login-limit table without modifying customer or order records.

## Operational boundary

The local Docker deployment is intended for a controlled workspace. If placed behind a proxy, configure the network boundary so the API sees a trusted client address; it does not accept an untrusted forwarded-address header. Account recovery, verified contact details, multi-factor authentication, alerts, and a managed production identity service remain future work. Keep `ORIGINALROOT_COOKIE_SECURE=1` when the service is exposed over HTTPS.

The IP-based limit can affect multiple users sharing one public address. It is a modest local safeguard, not a substitute for a production identity provider, WAF, or abuse-monitoring service.

## Next phase

Phase 16 adds safe cancellation of unaccepted customer requests. Profile and consent controls, verified account recovery, and a managed database and secret store still need to be addressed before access expands beyond a locally controlled rollout.
