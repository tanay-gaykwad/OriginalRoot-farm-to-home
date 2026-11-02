# OriginalRoot Phase 13: fresh produce and staple crops

## Goal

Support both perishable produce and staple crops in the same grower, review, marketplace, order, and batch-record flow, with category-aware units and clear customer filters.

## Included

- Growers classify an offer as **Fresh produce** or **Staples** and enter the crop name, quantity, selling unit, and minimum payout.
- Fresh offers accept kg, 500 g, 250 g, bunch, or dozen. Staple offers accept kg, quintal, or explicitly sized 25, 30, 50, and 100 kg bags.
- The API validates the category and unit combination, so a browser edit cannot publish an unsupported unit.
- Operators see the submitted category and confirm it before publishing. Customers can browse all offers or filter by category.
- Category travels with approved offers, batch passports, and new order snapshots. Bag prices are per stated bag; weights are explicit in the unit.
- Existing published offers without a category are returned to the review queue with their prior approval fields cleared. Existing customer orders remain intact. Reclassify and reapprove those offers before they appear for new requests.

## Data boundary

Crop names remain free text submitted by growers. Category labels organize offers; they do not independently verify the crop, grade, bag weight, food safety, or grower identity. Operator quality notes are records of review, not a certification. The local app continues to use SQLite and has no online payments.

## Next steps

- Add customer accounts or secure guest access, private order history, cancellation rules, and recovery (Phase 14).
- Add a governed crop and quality standard catalogue where local operators can define accepted names, grades, storage rules, and handling requirements.
- Move local records and secrets to protected production services before inviting public orders.
