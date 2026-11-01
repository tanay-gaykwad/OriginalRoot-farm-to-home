# OriginalRoot

OriginalRoot is an interactive preview of a farmer-led produce network. It brings together a customer shop, harvest traceability, transparent price breakdowns, and a grower workspace.

## Public preview

[OriginalRoot on GitHub Pages](https://tanay-gaykwad.github.io/originalroot-farm-to-home/)

The preview uses fictional farms, listings, harvest records, prices, and grower figures. It does not verify farms or food safety, contact farmers, reserve produce, process payments, or arrange delivery. There is no live marketplace service behind this site. Do not enter real customer, farmer, address, bank, or payment information.

## What you can explore

- Browse, search, and filter the example harvest.
- Open a sample Farm Passport with batch and handling details.
- Add produce to a basket and inspect an illustrative price breakdown.
- Record a non-personal sample order locally; the API validates product IDs and quantities and calculates totals from the shared catalog.
- Look up a sample order reference through the local API.
- Switch to the grower workspace and save a harvest-listing draft in the browser.
- Run the combined static site and local order API with Docker Compose.
- Submit an anonymous crop-demand signal for a nearby community. With the local API, only aggregate counts by crop and community are exposed; on GitHub Pages the signal stays in the visitor's browser.
- Submit a grower harvest offer with an explicit minimum payout, review it in the operator console, and publish only after entering the confirmed grade and full price split.
- Show operator-approved offers on the customer harvest board when the frontend is connected to the local API.

## Phase 1 product direction

OriginalRoot starts as a demand-led harvest network for one local corridor. Its first differentiator is helping growers plan from neighborhood demand while keeping growers in control of the minimum net payout and offer terms. Each batch should carry clear origin, grading, handling, and price-split records. Read the [Phase 1 product and operating plan](docs/PHASE_1.md) for scope, release gates, and success measures.

Phase 2 adds a grower offer → operator review → approved customer listing workflow. See the [Phase 2 operating workflow](docs/PHASE_2.md) for setup, review rules, and deployment boundaries.

Phase 3 adds pickup order requests, atomic quantity reservations, operator status updates, and reference-based customer tracking. See the [Phase 3 order workflow](docs/PHASE_3.md).

Phase 4 adds a public record for each approved batch and an operator console for appending harvest, weighing, grading, packing, and handoff checkpoints. Records are link-shareable and stored in SQLite. Operator-entered notes improve traceability but are not independent verification. See the [Phase 4 batch record workflow](docs/PHASE_4.md).

Phase 5 replaces the sample grower workspace with local grower accounts and account-owned harvest offers. Passwords are salted and hashed; sessions use an HTTP-only cookie; growers can see only their own offers. Profiles are self-entered and do not verify farmer identity. See the [Phase 5 grower account workflow](docs/PHASE_5.md).

Phase 6 replaces the shared operator key for routine access with named operator accounts, owner-managed staff access, and an attributable local operations history. The bootstrap key is used only for first-time owner setup. See the [Phase 6 operator workflow](docs/PHASE_6.md).

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
- `POST /api/operator/harvest-listings/{id}/passport-events` appends a harvest, weighing, grading, packing, or handoff checkpoint and records the operator's name.
- `POST /api/grower/register` creates a local grower profile; passwords must have at least 12 characters.
- `POST /api/grower/login` and `POST /api/grower/logout` start and revoke a seven-day HTTP-only local session.
- `GET /api/grower/me` returns the signed-in grower profile; `GET /api/grower/listings` returns only that grower's offers.
- `POST /api/harvest-listings` requires a signed-in grower; farm name and ownership are taken from the account.
- `POST /api/orders` requests pickup of a published offer. Quantity reservation is atomic; at least one operator account must exist. This stores the customer's name and mobile number in the local SQLite database.
- `GET /api/orders/{reference}` returns status and pickup notes without customer contact details.
- `GET /api/operator/orders` and `POST /api/operator/orders/{reference}/status` expose and update the pickup queue to signed-in operators.
- `GET /api/operator/setup-status` checks whether the first owner account is needed.
- `POST /api/operator/bootstrap` creates the first owner account with the local bootstrap key; after setup this endpoint cannot be used again.
- `POST /api/operator/login`, `POST /api/operator/logout`, and `GET /api/operator/me` manage named operator sessions.
- `POST /api/operator/password` changes the signed-in operator's password and revokes its other sessions.
- `GET /api/operator/users` and `POST /api/operator/users` let the owner view and create operator accounts.
- `GET /api/operator/audit` returns the latest 100 attributed operations events.
- `POST /api/demo/orders` records a non-personal sample order. The request body contains only product IDs and quantities.
- `GET /api/demo/orders/{reference}` retrieves that sample order and its price breakdown.

The API binds to `127.0.0.1` by default. Named operator sessions protect review and order-management endpoints; the bootstrap key is limited to first-owner setup. Local sessions and the audit history are not a production identity, recovery, backup, or tamper-proof audit service. Do not expose this server to the internet. The GitHub Pages site hosts the frontend only, has no shared API, and disables account-based operations.

## Product direction

- Start with a responsive web app and validate one local supply corridor before native apps or multi-city operations.
- Treat the physical operation as part of the product: farmer onboarding, collection, grading, packing, fulfilment, and complaint handling.
- Show farmer proceeds, packing, platform coordination, and route cost separately.
- Treat storage as optional and crop-specific; do not base the model on deliberately creating scarcity.
- A QR code points to records; it does not independently prove the records are true.
- Add verified accounts, real inventory, payment integrations, and production hosting only after operational, legal, and security review.

## Before a live pilot

Replace sample data with field-verified records; add authenticated farmer, customer, operator, and administrator roles; establish grade and rejection standards with evidence and appeals; add secure payment-provider integration; define food-safety, privacy, complaint, refund, retention, and backup procedures; and review applicable state and food-business requirements. Validate the real unit economics in one crop corridor before expanding.

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

