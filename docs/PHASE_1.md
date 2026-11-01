# OriginalRoot Phase 1: demand-led local harvests

## Product promise

Help a small group of growers in one local corridor decide what to harvest and how much, using visible buyer interest and farmer-approved terms. Keep each crop batch identifiable and show how the customer price is divided. The first release optimizes for trust and predictable sales, not rapid city expansion.

## The first customer problem

Growers often make harvest and selling decisions with weak visibility into household demand. Buyers see little about who grew the food, how it was graded, or how the price was set. OriginalRoot should connect those decisions with a simple, auditable record.

## Phase 1 scope

1. **One pilot corridor:** Mysuru and nearby communities. Validate actual route density and partner capacity before adding locations.
2. **Demand window:** households can submit anonymous crop, neighborhood, and quantity interest. This is a planning signal, not a reservation, order, or promise to buy.
3. **Grower-controlled offer:** before a batch is published in a real service, its grower confirms available quantity, harvest window, grade standard, minimum net payout, and acceptance of the buyer-facing price.
4. **Batch passport:** record the grower or collective, field/collection point, harvest date, measured weight, grade and evidence, packing, and handoffs. A QR code links to the record; it does not itself verify the claims.
5. **Price waterfall:** show grower net payout, grading/packing, platform coordination, route delivery, and the total before checkout. No hidden quality surcharge.
6. **Fulfillment loop:** confirm collection cutoffs, grouped delivery windows, substitutions, rejection evidence, complaints, and refunds before accepting payment.

## What this repository implements now

- Responsive customer storefront, sample batch passports, basket price breakdown, and a grower workspace.
- Anonymous demand-signal form. A local API stores signals in SQLite and exposes only totals grouped by crop and community. No household-level signal history is returned by the aggregate endpoint.
- Without the local API, the static GitHub Pages build saves a signal in that browser only; it is not shared with growers or other visitors.
- Illustrative catalog and grower figures are marked as such. The interface does not claim that these farms are verified or that produce can be bought or delivered.
- Phase 2 adds an offer review queue and an approved-offer listing flow. See [Phase 2](PHASE_2.md).

## Release gates before taking real orders

- Recruit and consent real growers/FPO partners; verify farm and batch details in person.
- Agree a written grade rubric, weighing process, minimum grower payout, rejection appeals, and settlement timing.
- Run route and cold-chain trials; publish service areas and delivery cutoffs only when operationally staffed.
- Replace local-only demand collection with a secured hosted API, authenticated operator/grower roles, rate limits, backups, and privacy/retention rules.
- Add a payment provider only after order acceptance, refunds, reconciliation, and applicable Indian business, food-safety, tax, and privacy requirements have been reviewed.
- Test the full flow with a small invited group and publish measured fulfillment, complaint, farmer payout, and repeat purchase results.

## Success measures

- Grower net payout per accepted kilogram versus the grower's comparable alternative.
- Share of listed produce sold at the grower's agreed minimum payout.
- Forecast error between demand signals and accepted orders.
- On-time, in-full delivery rate and quality-related rejection rate.
- Complaint resolution time and repeat household purchase rate.

## Product rule

Do not withhold available food to manufacture scarcity. Use optional crop-appropriate storage only to reduce spoilage or meet a confirmed later demand window, and disclose the storage time and handling.

