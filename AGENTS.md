# Calendar repository instructions

## Critical reservation mutation policy

CalApp reservations and the inventory events produced from them are business-critical production
data. Treat every reservation create, update, cancellation, block, and reopen as a high-risk mutation.

- Never create, edit, or cancel a live reservation as an informal test. Require an explicitly identified
  date, room, intended status, and user authority for a manual production change.
- A successful reservation create/update/cancel must write its durable inventory outbox event in the
  same database transaction. Never bypass or manually discard that event.
- Read-only audit/report endpoints must never mutate a reservation or partner inventory.
- Preserve date-only, multi-night, room mapping, cancellation, idempotency, and duplicate protections.
- The worker must verify partner state after a change. Do not present an unverified change as complete.
- Every system-processed reservation create/update/cancel and every resulting partner block/reopen
  attempt must produce a detailed Telegram message headed `[스테이남천 예약 동기화]`, including
  trigger, trace/event ID, target date and room/product, per-site outcome, and actionable failure reason.
- Live operation requires Telegram configuration. Delivery failures must be visible through StaySync
  critical alerts and durable logs and must never cause a blind repeat of an already successful toggle.
