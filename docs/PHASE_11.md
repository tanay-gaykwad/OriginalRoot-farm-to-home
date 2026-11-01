# OriginalRoot Phase 11: brand website and platform entry

## Goal

Give OriginalRoot a clear public introduction and a separate entry point to the working platform, so the brand website and the operational app have different jobs.

## Included

- `/` introduces OriginalRoot, its operating principles, and the roles for growers, customers, and local operators.
- `/?platform=1&workspace=shop` opens the marketplace workspace.
- `/?platform=1&workspace=grower` opens the grower workspace.
- `/?platform=1&workspace=operator` opens local operations.
- Workspace state is reflected in the URL and follows browser Back/Forward navigation.
- The public site links into the relevant app workspace and the app provides a way back to the OriginalRoot introduction.

The same query routes work at the GitHub Pages project URL. GitHub Pages still hosts static files without the shared database or API; local Docker and the desktop app connect to their local API.

## Launch guidance

OriginalRoot does not need every planned feature before it can launch anything. The brand website can be public as an introduction. A controlled corridor pilot can begin after local supply, product grading, order cutoffs, pickup or delivery capacity, customer support, and data consent are confirmed with the people operating it.

Do not invite the general public to place real orders until the platform has a hosted production API, managed database, customer account or secure guest-order flows, payment and refund handling, protected backups, account recovery, privacy and retention controls, and a staffed fulfilment process. The current local app has no payment integration and must not be exposed to the internet.

## Remaining roadmap

1. **Phase 12 — Operational app shell:** turn the three role workspaces into clear, direct routes with persistent navigation, account state, and task-focused pages. Remove browser-only sample checkout fallbacks from the working app.
2. **Phase 13 — Product and inventory system:** move crops, categories, grades, units, and stock from the static example catalog into operator-managed records. Support fresh produce and grains/pulses in the same catalog while allowing crop-specific grade and storage rules.
3. **Phase 14 — Customer identity and order lifecycle:** add customer profiles and order history or a secure guest-order alternative, reliable cancellation, refunds, and account recovery.
4. **Phase 15 — Production data foundation:** add database migrations, a managed hosted database, private object storage for evidence, automated encrypted off-site backups, monitoring, and environment-based secret management.
5. **Phase 16 — Payments and settlement:** choose an appropriate provider, add server-side payment and refund APIs, settlement reconciliation, and clear grower payout records. Never place provider API secrets in browser code or Git.
6. **Phase 17 — Pilot and public launch gates:** validate one real corridor with participating growers and customers, record delivery and complaint outcomes, review local legal/privacy/food-handling requirements, and only then widen access.

## Credentials and data boundary

OriginalRoot must never store plaintext passwords. The local API currently stores salted password hashes and keeps session tokens in HTTP-only cookies. Production deployment still needs HTTPS, secure cookies, account recovery, rate limiting, key rotation, a protected secret store, and an access-controlled customer data policy. Provider API keys belong only in backend secrets, not React code, browser storage, screenshots, or the repository.

## Current boundary

The Phase 11 website and route separation improve product structure and navigation. They do not add hosted services, payment processing, customer accounts, farmer identity verification, food certification, or a staffed supply corridor.
