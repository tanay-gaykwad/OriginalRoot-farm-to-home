# OriginalRoot Phase 12: live marketplace boundary

## Goal

Make the customer workspace transact only against grower offers that exist in the connected OriginalRoot service. A browser-only confirmation must never look like a placed order.

## Included

- Removed the static sample-product basket and its local-storage order fallback from the platform workspace.
- The marketplace reads the reviewed-offer API and creates requests only against an approved grower offer.
- The interface distinguishes loading, an available but empty marketplace, and a disconnected marketplace.
- Order creation remains explicit about operator confirmation and the absence of online payment.
- The brand website remains separate from the local operational service; GitHub Pages has no shared customer or grower data.

## Current operating boundary

This makes the customer request flow honest and connected for a locally hosted service. It does not provide customer accounts, online payments, SMS, public hosting, or a staffed delivery network. Keep the local API on loopback and use only data the local operators are authorized to handle.

## Next build steps

1. **Phase 13 — Crop groups and selling units (complete):** support fresh produce and grains/pulses in the same offer and order flow. See [Phase 13](PHASE_13.md).
2. **Phase 14 — Customer identity and order lifecycle:** customer order history or protected guest access, cancellations, account recovery, and clear dispute outcomes.
3. **Phase 15 — Production data foundation:** hosted database and API, private evidence storage, encrypted backups, monitoring, and a managed secret store.
4. **Phase 16 — Payments and settlement:** integrate a suitable provider server-side, then record refunds and grower settlements with reconciliation.
5. **Phase 17 — Corridor validation and release gates:** confirm real growers, grading, handling, transport, support, privacy, and local compliance before opening public orders.

## Secret handling

Passwords must remain salted, one-way hashes. API and payment keys belong in a protected backend secret store or deployment environment, never in browser code or Git. Production also needs HTTPS, secure session configuration, rate limiting, rotation, backups, and a documented retention policy.
