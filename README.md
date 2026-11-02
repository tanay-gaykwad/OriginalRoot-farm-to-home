# OriginalRoot

OriginalRoot is a locally hosted farmer-to-home marketplace workflow for growers, customers, and the people coordinating orders. It connects grower harvest offers to customer orders, records batch checkpoints and price splits, and includes local delivery, account workspaces, and support handling. It is designed to help a small team trial one supply corridor before taking on a public launch.

[![Build](https://github.com/tanay-gaykwad/originalroot-farm-to-home/actions/workflows/build.yml/badge.svg?branch=main)](https://github.com/tanay-gaykwad/originalroot-farm-to-home/actions/workflows/build.yml)
[![Pages preview](https://github.com/tanay-gaykwad/originalroot-farm-to-home/actions/workflows/pages.yml/badge.svg?branch=main)](https://github.com/tanay-gaykwad/originalroot-farm-to-home/actions/workflows/pages.yml)

## See it working

Open the [OriginalRoot website](https://tanay-gaykwad.github.io/originalroot-farm-to-home/) to learn about the brand and its approach. Choose **Explore OriginalRoot** to enter the marketplace workspace, or open the local platform with Docker or the desktop installer for shared local data and API workflows.

To try the working local workflows, start OriginalRoot with Docker Compose using the steps below. The marketplace, grower accounts, operator review, order tracking, and support queue then share a local SQLite database.

For a Windows desktop installer, download the latest `OriginalRoot-Setup` `.exe` from [GitHub Releases](https://github.com/tanay-gaykwad/originalroot-farm-to-home/releases). It installs a local desktop app that starts its API on loopback and stores its database in the current Windows user's app data. On first launch, copy the generated one-time key and use it in Operations to create the owner account. The installer is not code-signed, so Windows may show an unknown-publisher warning or a managed device may block it.

Read the [Windows installer guide](docs/DESKTOP_INSTALLER.md) for setup, first owner access, and local data backup steps.

## Who it is for

- **Growers:** submit harvest offers with a stated minimum payout and track offer review.
- **Customers:** browse approved offers, request pickup or local delivery, track an order, and raise an order concern.
- **Local operators:** review offers, coordinate fulfilment, record batch checkpoints, and respond to customer or grower support tickets.

## Current scope

The public homepage is the OriginalRoot brand introduction. The platform app is available through its **Explore OriginalRoot** action and at `/?platform=1`; its marketplace, grower, customer, and operations workspaces have distinct shareable URLs. GitHub Pages has no shared API or database and reports that boundary in the marketplace. Docker and the Windows desktop app use a local API and SQLite database for grower and customer accounts, private customer order history, operator review, real order requests, delivery handoffs, batch records, and support tickets. Fresh produce and grains/pulses share one offer flow with category-aware units and customer filters. Customers may order as guests or sign in; guest tracking requires their order reference and checkout mobile number. Customer accounts include password hashing, basic sign-in throttling, and password change with session revocation. Mobile numbers are not OTP-verified, and the platform has no online payment, SMS, or driver network. Keep the local service bound to loopback. See the [Phase 11 launch roadmap](docs/PHASE_11.md), [Phase 12 marketplace boundary](docs/PHASE_12.md), [Phase 13 crop categories and units](docs/PHASE_13.md), [Phase 14 customer accounts](docs/PHASE_14.md), and [Phase 15 account security](docs/PHASE_15.md).

## What you can explore

- Browse only grower offers published after local operator review, with quantity, grade, and price breakdown visible.
- Browse one offer board or filter fresh produce separately from grains, pulses, and oilseeds (staples). Selling units are validated for each group, including explicitly sized staple bags.
- Request pickup or local delivery from an approved offer; orders reserve real offer quantity and await operator confirmation. No payment is taken.
- Track a guest order with its reference and checkout mobile number, or view account-linked requests in My orders.
- Create a customer account, place account-linked requests, and view private order history; guest requests remain supported.
- Create a grower account, submit crop offers, and follow their review status.
- Run the combined static site and local order API with Docker Compose.
- Submit an anonymous crop-demand signal for a nearby community. With the local API, only aggregate counts by crop and community are exposed; on GitHub Pages the signal stays in the visitor's browser.
- Submit a grower harvest offer with an explicit minimum payout, review it in the operator console, and publish only after entering the confirmed grade and full price split.
- Show operator-approved offers on the customer harvest board when the frontend is connected to the local API.
- Report order concerns, submit grower grievances, and record operator follow-up in the Phase 8 support workflow.
- Submit harvest evidence from a grower account, review it in Operations, and show approved evidence on the public batch passport.

## Phase 1 product direction

OriginalRoot starts as a demand-led harvest network for one local corridor. Its first differentiator is helping growers plan from neighborhood demand while keeping growers in control of the minimum net payout and offer terms. Each batch should carry clear origin, grading, handling, and price-split records. Read the [Phase 1 product and operating plan](docs/PHASE_1.md) for scope, release gates, and success measures.

Phase 2 adds a grower offer → operator review → approved customer listing workflow. See the [Phase 2 operating workflow](docs/PHASE_2.md) for setup, review rules, and deployment boundaries.

Phase 3 adds pickup order requests, atomic quantity reservations, operator status updates, and reference-based customer tracking. See the [Phase 3 order workflow](docs/PHASE_3.md).

Phase 4 adds a public record for each approved batch and an operator console for appending harvest, weighing, grading, packing, and handoff checkpoints. Records are link-shareable and stored in SQLite. Operator-entered notes improve traceability but are not independent verification. See the [Phase 4 batch record workflow](docs/PHASE_4.md).

Phase 5 replaces the sample grower workspace with local grower accounts and account-owned harvest offers. Passwords are salted and hashed; sessions use an HTTP-only cookie; growers can see only their own offers. Profiles are self-entered and do not verify farmer identity. See the [Phase 5 grower account workflow](docs/PHASE_5.md).

Phase 6 replaces the shared operator key for routine access with named operator accounts, owner-managed staff access, and an attributable local operations history. The bootstrap key is used only for first-time owner setup. See the [Phase 6 operator workflow](docs/PHASE_6.md).

Phase 7 adds local delivery requests, private delivery addresses, a customer-facing order history, and a one-time handoff code verified by an operator before delivery completion. Pickup remains available. See the [Phase 7 local delivery workflow](docs/PHASE_7.md).

Phase 8 adds customer order complaints, grower grievances, private ticket lookup, operator investigation and resolution timelines, and an attributable audit record. Refund and replacement choices are requests for review only; no money or replacement is processed. Support workflows require the local Docker/API deployment and are not active on the static GitHub Pages preview. See the [Phase 8 customer and grower support workflow](docs/PHASE_8.md).

Phase 9 adds private grower image submissions for a batch, operator evidence review, checksum-checked local file storage, and approved evidence on the public batch passport. Operator review is not independent certification. See the [Phase 9 evidence workflow](docs/PHASE_9.md).

Phase 10 adds owner-controlled operator suspension and reactivation, session revocation, verified database-and-evidence backup bundles, and a careful restore command. See the [Phase 10 operations guide](docs/PHASE_10.md) and the [local pilot runbook](docs/PILOT_RUNBOOK.md).

Phase 11 separates the OriginalRoot brand introduction from the marketplace, grower, and operator workspaces. It also records what must be built and validated before a controlled pilot or public customer launch. See the [Phase 11 structure and launch roadmap](docs/PHASE_11.md).

Phase 12 removes the browser-only sample basket and checkout path. The customer marketplace now uses reviewed offers from the connected API and distinguishes an empty market from a disconnected service. See the [Phase 12 marketplace boundary](docs/PHASE_12.md).

Phase 13 adds Fresh produce and Staples to the grower offer, operator review, batch passport, and customer order flows. Category and selling-unit combinations are validated by the API; the customer board can filter both groups. See the [Phase 13 crop categories and units](docs/PHASE_13.md).

Phase 14 adds customer sign-in, account-linked order requests, private order history, and mobile-number matching for guest order tracking. It does not add phone verification, account recovery, or payments. See the [Phase 14 customer account workflow](docs/PHASE_14.md).

Phase 15 adds basic sign-in throttling, password change, and revocation of other customer sessions when credentials change. It is a local safeguard, not a production identity provider. See the [Phase 15 account security](docs/PHASE_15.md).

## Run locally

Run these commands from the project root:

```powershell
pnpm install --frozen-lockfile
```

Start the local API in one terminal:

```powershell
$env:OriginalRoot_OPERATOR_TOKEN = "replace-with-a-long-random-bootstrap-key"
python api/server.py
```

Start the web app in another terminal:

```powershell
pnpm dev
```

Open `http://localhost:5173`. Vite forwards `/api` requests to the local API on port 8080. Use the Operations page to enter the same key and review offers. The key is kept in page memory and sent only to the same-origin local API.

### Build and serve locally

```powershell
pnpm build
python api/server.py
```

Then open `http://127.0.0.1:8080`.

### Run with Docker

```powershell
Copy-Item .env.example .env
# Edit .env and replace the placeholder with a long random first-owner bootstrap key.
docker compose up --build -d
docker compose ps
```

Open `http://127.0.0.1:8080`. In Operations, use the key from `.env` once to create the owner account, then sign in with that account. The owner can provision named operator accounts; the bootstrap key is not used for normal reviews. App data is stored in the `OriginalRoot-data` Docker volume. The app is available only on this computer; the published container port is bound to loopback. Stop it with `docker compose down`; use `docker compose down -v` only if you intend to erase its database volume.

For a first-use walkthrough of offers, delivery, and support, see the [Phase 8 operating guide](docs/PHASE_8.md) and the earlier [phase guides](docs/).

## Local API

- `GET /api/health` reports local pilot mode, whether operator review is configured, and that payments are disabled.
- `GET /api/products` returns the same example catalog used by the web app.
- `POST /api/harvest-demand` accepts a crop, supported community, and household quantity without collecting personal details.
- `GET /api/harvest-demand` returns aggregate quantity and signal counts by crop and community, never individual signal records.
- `POST /api/harvest-listings` creates a private pending offer with the grower's stated minimum payout.
- `GET /api/harvest-listings` returns approved offers only.
- `GET /api/harvest-listings?scope=review` returns the pending queue to a signed-in operator.
- `POST /api/operator/harvest-listings/{id}/decision` approves or declines a pending offer. Approval checks that grower payout is at least the stated floor and calculates the customer price from the four visible price components. Requires an operator session.
- `GET /api/harvest-listings/{id}/passport` returns the public batch record for an approved offer, including its price split and recorded checkpoints.
- `GET /api/operator/passports` lists published batches for a signed-in operator.
- `GET|POST /api/grower/evidence` lists or submits image evidence for the signed-in grower's own pending or published offer.
- `GET /api/operator/evidence` lists batch evidence for signed-in operator review.
- `POST /api/operator/evidence/{evidence_id}/decision` approves, declines, or withdraws approval with a review note and attributed history.
- `GET /api/evidence/{evidence_id}/file` serves an image publicly only after approval and publication; its stored size and SHA-256 checksum are checked.
- `POST /api/operator/harvest-listings/{id}/passport-events` appends a harvest, weighing, grading, packing, or handoff checkpoint and records the operator's name.
- `POST /api/grower/register` creates a local grower profile; passwords must have at least 12 characters.
- `POST /api/grower/login` and `POST /api/grower/logout` start and revoke a seven-day HTTP-only local session.
- `GET /api/grower/me` returns the signed-in grower profile; `GET /api/grower/listings` returns only that grower's offers.
- `POST /api/harvest-listings` requires a signed-in grower; farm name and ownership are taken from the account.
- `POST /api/orders` requests local delivery or pickup of a published offer. Quantity reservation is atomic; at least one operator account must exist. Delivery requests store an address and return a one-time handoff code; only its hash is stored.
- `GET /api/orders/{reference}` returns fulfilment type, status, and customer-facing status history without contact details or delivery address.
- `GET /api/operator/orders` exposes customer contact and delivery details to signed-in operators. `POST /api/operator/orders/{reference}/status` enforces the correct pickup or delivery lifecycle; delivery completion requires the customer handoff code.
- `GET /api/operator/setup-status` checks whether the first owner account is needed.
- `POST /api/operator/bootstrap` creates the first owner account with the local bootstrap key; after setup this endpoint cannot be used again.
- `POST /api/operator/login`, `POST /api/operator/logout`, and `GET /api/operator/me` manage named operator sessions.
- `POST /api/operator/password` changes the signed-in operator's password and revokes its other sessions.
- `GET /api/operator/users` and `POST /api/operator/users` let the owner view and create operator accounts.
- `POST /api/operator/users/{id}/status` lets the owner suspend or reactivate an operator; suspension revokes all of that operator's sessions.
- `GET /api/operator/audit` returns the latest 100 attributed operations events.
- `POST /api/support/customer-tickets` submits a concern for an existing order after matching its checkout phone number.
- `POST /api/support/customer-ticket-status` looks up a customer ticket after matching the order phone number.
- `GET|POST /api/grower/support-tickets` lists or creates grievances for the signed-in grower.
- `GET /api/operator/support-tickets` lists support requests for signed-in operators.
- `POST /api/operator/support-tickets/{ticket_id}/status` records an operator update and allowed status transition.
- `POST /api/demo/orders` records a non-personal sample order. The request body contains only product IDs and quantities.
- `GET /api/demo/orders/{reference}` retrieves that sample order and its price breakdown.

The API binds to `127.0.0.1` by default. Named operator sessions protect review and order-management endpoints; the bootstrap key is limited to first-owner setup. `python api/backup.py create`, `verify`, and `restore` manage local data bundles; backups are manual, unencrypted, and must be copied to protected storage outside the Docker volume. Local sessions and the audit history are not a production identity, recovery, remote backup, or tamper-proof audit service. Do not expose this server to the internet. The GitHub Pages site hosts the frontend only, has no shared API, and disables account-based operations.

## Product direction

- Start with a responsive web app and validate one local supply corridor before native apps or multi-city operations.
- Treat the physical operation as part of the product: farmer onboarding, collection, grading, packing, fulfilment, and complaint handling.
- Show farmer proceeds, packing, platform coordination, and route cost separately.
- Treat storage as optional and crop-specific; do not base the model on deliberately creating scarcity.
- A QR code points to records; it does not independently prove the records are true.
- Add verified accounts, real inventory, payment integrations, and production hosting only after operational, legal, and security review.

## Before a live pilot

Use the [local pilot runbook](docs/PILOT_RUNBOOK.md) before inviting participants. A public service still requires a secured hosted backend, identity and account-recovery controls, protected scheduled off-host backups, a retention and deletion process, tested field and food-handling procedures, a complaint and refund policy, and applicable legal and business review. Validate the real unit economics in one crop corridor before expanding.

## Technology

- React, TypeScript, Vite, and Lucide icons
- Python standard-library HTTP server for the local order API
- SQLite for local sample-order persistence
- Named operator accounts with owner-managed provisioning and attributed local audit history
- SQLite-backed batch passports with operator-recorded handling checkpoints
- Local grower sessions and account-owned offer history
- Docker Compose for a one-command local package

## License

OriginalRoot's original project code is released under the MIT License. Third-party dependencies retain their own licenses.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, change expectations, and the pull request process. Report vulnerabilities privately using the instructions in [SECURITY.md](SECURITY.md). Please do not publish secrets, personal farmer or customer information, or exploitable security details in a public issue.

Automated checks build the frontend and Docker image and compile-check the Python API on pushes and pull requests. The Pages workflow separately builds and publishes the static preview from `main`. These checks cover build correctness, not field readiness or operational claims.

