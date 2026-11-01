# OriginalRoot Phase 2: reviewed harvest offers

## Goal

Build the supply-side workflow that turns a grower's proposed harvest into a clearly priced, operator-reviewed offer. Every submission stays private until its grower payout floor, quantity, grade, and customer price are confirmed.

## Included

- Grower offer form: crop, farm/collective display name, supported community, quantity, unit, harvest window, and minimum net payout per unit. It collects no phone, bank, address, or payment details.
- SQLite offer queue with `pending`, `published`, and `rejected` states.
- Operator review page protected by a server-configured bearer key. The key remains in page memory and is not stored in browser storage.
- Approval form for confirmed quantity and grade, grower payout, packing, coordination, and route cost. The server enforces quantity not above the grower's offer and payout not below the stated minimum; it calculates the customer price as the sum of the four components.
- Decline decision requires a reason. Pending offers are never visible in the public listing endpoint.
- Customer page displays published offers with the price waterfall. It does not present these offers as checkout-ready orders.

## Local setup

Set a long random operator key in the API server environment before starting the app:

```powershell
$env:OriginalRoot_OPERATOR_TOKEN = "replace-with-a-long-random-secret"
python api/server.py
```

Start the Vite frontend separately with `pnpm dev`, then open the Operations page and enter the same key. For Docker Compose, place the key in a local `.env` file. `.env` is git-ignored. The container's host port is bound to loopback.

## Current deployment boundary

GitHub Pages serves only the static frontend. It does not host this SQLite API or store shared offers. A listing submitted there stays in that browser; operator tools require a local API server. No real customer purchase, payment, fulfillment, or farmer identity verification is supported yet. Do not expose the local server to the public internet.

Before a real pilot, deploy a secured backend with individual grower/operator accounts, verified identities, request throttling, audit logs, backups, privacy/retention controls, and an agreed grading and appeals process. Validate each submitted offer with the grower and record evidence before approval. Add checkout and delivery only after fulfillment capacity, refunds, and settlement procedures are ready.

## Phase 2 acceptance criteria

- A grower can submit an offer with a minimum payout and see that it is pending review.
- A visitor cannot fetch pending or rejected offers through the public endpoint.
- An operator without the configured key cannot load or change the review queue.
- The API rejects an approval with quantity above the offer or payout below the grower's floor.
- An approved listing's displayed customer price equals grower payout + packing + coordination + route cost.
- A declined offer is hidden from the public endpoint and includes a review reason in the operator record.

