# OriginalRoot Phase 4: traceable batch records

## Goal

Give each approved harvest a public batch record that connects the grower-approved listing and price split to operator-entered handling checkpoints. The record is shareable by a link and is stored in the same local SQLite service as offers and orders.

## Included

- A public batch record for published offers only. Pending, rejected, and unknown offers return not found.
- The approved crop, grower or collective display name, community, quantity, grade, review time, and full price split.
- An operator-only console for appending harvest, weighing, grading, packing, and handoff checkpoints.
- Server-generated UTC timestamps, operator attribution, optional place, and a short operator note for each checkpoint.
- Append-only event history: there is no edit or delete API for recorded checkpoints.
- Customer-facing batch record link that can be copied and reopened in the local app with a `?passport=` query.
- Clear disclosure that an operator-entered checkpoint is not independent verification.

## API

- `GET /api/harvest-listings/{id}/passport` returns the public record for a published batch.
- `GET /api/operator/passports` lists published batches and checkpoint counts; requires a signed-in operator session.
- `POST /api/operator/harvest-listings/{id}/passport-events` adds a checkpoint; requires an operator session. The body uses `event_type` (`harvested`, `weighed`, `graded`, `packed`, or `handed_off`), optional `location`, and `detail`.

## Record integrity and limits

The API stores checkpoint text and the time the local server accepted it. It does not validate GPS, photos, weighing equipment, organic claims, or third-party attestations. Operators should record only observations made with the grower and preserve supporting documents outside this app until an evidence-upload and verification process exists. SQLite append-only behavior is an application rule, not tamper-proof or cryptographic storage. The local API is not safe to expose publicly.

## Acceptance criteria

- A visitor can view records only for published batches; private offers stay private.
- A visitor can see the full approved price split and the recorded timeline without seeing customer contact details.
- A visitor without an operator session cannot list or append checkpoints.
- Checkpoint text, type, and location are validated and timestamps are assigned by the server.
- Every checkpoint remains visible in order after the app restarts because it is stored in SQLite.
- UI and API disclose that operator records are not independently verified.

## Next operational step

Before treating a record as a quality or origin assurance, define a grower-consented evidence checklist, field verification ownership, correction and dispute process, and storage/retention rules. A real QR label should be generated from a stable hosted passport URL after the public API and identity model are deployed securely.

