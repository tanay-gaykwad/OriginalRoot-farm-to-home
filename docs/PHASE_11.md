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

## Roadmap status

Phases 12–19 are complete as documented in [Phase 12](PHASE_12.md), [Phase 13](PHASE_13.md), [Phase 14](PHASE_14.md), [Phase 15](PHASE_15.md), [Phase 16](PHASE_16.md), [Phase 17](PHASE_17.md), [Phase 18](PHASE_18.md), and [Phase 19](PHASE_19.md). Together they make a connected local app for reviewed offers, customer requests, grower and customer accounts, order tracking, batch records, support, mandi references, and the producer-first marketplace.

## Remaining before hosted/public launch

1. **Production data foundation:** hosted API, managed database, object storage, automated encrypted off-site backups, restore drills, monitoring, and secret management.
2. **Customer relationship and settlement:** direct buyer/grower messaging, verified account recovery, payment authorization, refunds, reconciliation, and grower payouts.
3. **Field operations and launch gates:** validate supply, grading, food handling, delivery, and complaints in one corridor; complete privacy, security, and applicable legal review before widening access.

## Credentials and data boundary

OriginalRoot must never store plaintext passwords. The local API stores salted password hashes and keeps session tokens in HTTP-only cookies. It checks browser write origins, limits repeated operator/grower sign-in attempts, and applies owner-only file permissions to its local SQLite data where supported. Production deployment still needs HTTPS, secure cookies enabled, account recovery, distributed rate limiting, key rotation, a protected secret store, and an access-controlled customer data policy. Provider API keys belong only in backend secrets, not React code, browser storage, screenshots, or the repository.

## Current boundary

The Phase 11 website and route separation improve product structure and navigation. They do not add hosted services, payment processing, customer accounts, farmer identity verification, food certification, or a staffed supply corridor.
