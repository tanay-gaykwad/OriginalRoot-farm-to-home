# OriginalRoot Phase 19: producer-first marketplace and local safeguards

## Product direction

Pocket Marche is a reference for the buying experience, not a visual or copy template. The useful pattern is to put the producer and the food together: listings should carry the maker's voice, useful harvest details, and approved photographs, then give the buyer a clear path through price, order, and fulfilment.

## Included

- Growers can add a short, optional harvest note when submitting an offer. It travels with the private review record and appears on the published offer and batch passport.
- The public marketplace uses the first operator-approved image attached to that batch. A listing without an approved photo gets an original category-specific visual; it does not borrow a stock image or imply that inventory exists.
- The offer card gives the crop, grower, community, available quantity, harvest window, grade, and per-unit price split a more readable hierarchy.
- The full marketplace journey is visible inside the app: introduction, local marketplace, working principles, and grower entry.
- Browser write requests that include an `Origin` must match the request host. Operator and grower sign-ins are blocked for 15 minutes after five failed attempts from the same client address.
- SQLite data and its evidence directory are created with owner-only filesystem permissions on supported filesystems; SQLite uses a five-second busy timeout, full synchronous writes, and secure-delete behavior.

## Existing-data handling

The startup schema adds `grower_note` to existing SQLite databases with an empty default. It does not replace or delete current listings, orders, accounts, evidence, or volumes. The approved-image field is derived from already-reviewed batch evidence.

## Local database security boundary

The local Compose app uses SQLite in the persistent `originalroot-data` volume and is published only on loopback. Filesystem permissions reduce accidental access by other local users. SQLite is not encrypted at rest, and this is not a managed, multi-region, or internet-facing production database. Local backups remain manual and unencrypted; protect them separately.

For the local Docker app, `ORIGINALROOT_COOKIE_SECURE=0` is appropriate because it uses loopback HTTP. When served behind HTTPS, set `ORIGINALROOT_COOKIE_SECURE=1` so session cookies use the `Secure` attribute. The server does not enable cross-origin API access. Keep the one-time operator bootstrap secret and external API keys in an untracked `.env` file or a deployment secret manager.

## Reference and adaptation

Pocket Marche describes producer listings, mobile order management, direct producer/customer communication, and connected shipping workflows on its [official producer site](https://producer.pocket-marche.com/). OriginalRoot adapts the producer-first listing principle to a local Indian crop flow, where an operator reviews each offer and coordinates pickup or local delivery.

## Still needed before public launch

- HTTPS-hosted API and a managed database with automated encrypted off-site backups and tested restore procedures.
- Recovery-ready identity, verified contact details, privacy retention/deletion operations, production monitoring, and a formal security review.
- Direct buyer/grower messaging, online payment and refund settlement, and a staffed fulfilment network; these are not implemented here.
- Field validation for farmer onboarding, price negotiation, grading, food handling, delivery and grievance resolution.

The current version is suitable for local Docker workflows and a controlled product review. Do not expose the local API directly to the internet or represent operator review as independent certification.
