# Notification delivery guarantee — SDK limitation

Date: 2026-11-13  
Status: Verified against the AppDeploy SDK notification reference.

The documented `notifications.send()` input accepts `userIds`, notification/data payload, and optional `ttlSeconds`. It does **not** expose a caller-supplied idempotency key or delivery receipt lookup.

## Consequence

A database outbox can prevent two workers from claiming the same pending reminder concurrently, but it cannot guarantee exactly-once external push delivery across the failure window:

1. Push provider accepts the notification.
2. The worker crashes or the database write marking the outbox item delivered fails.
3. The outbox still appears claimed/pending after its lease expires.
4. Retrying may send a duplicate.

Conversely, never retrying an ambiguous claimed item avoids duplicates but can lose a reminder if the first send did not reach the provider.

## Safe product behavior

- Use an atomic claim/lease to prevent ordinary concurrent duplicate sends.
- Persist the claim before calling `notifications.send()`.
- Inspect the returned `sent` and `failed` counts; do not treat a resolved Promise alone as success.
- Persist delivery outcomes with a conditional patch.
- For ambiguous outcomes after a crash, mark the item `needs_review` rather than automatically resending until provider-side idempotency or delivery reconciliation is available.
- Expose an operational log for unresolved reminders; never claim exactly-once delivery.
- Revisit automatic retry only if AppDeploy adds a documented idempotency key or queryable provider receipt.

This is a deliberate reliability trade-off, not a reason to claim the reminder system is fully deduplicated.
