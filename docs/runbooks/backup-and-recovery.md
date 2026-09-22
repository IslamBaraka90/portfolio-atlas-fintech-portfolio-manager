# Backup, restore and replay

## Take a checkpoint

Use a durable workspace started with `npm run dev`; the default SQLite database and immutable raw evidence share `.data`. Custom DATABASE_PATH uses its containing directory for the archive as well. A custom in-memory archive disables recovery.

In **Governance & recovery**, sign in as approver (or use the labeled local-owner lesson), write a reason and create a backup. The server creates `backups/<UUID>/book.sqlite`, required content-addressed raw files and `manifest.json`. The API records the manifest hash and cutoff counts only after creation succeeds. A retried command returns the same checkpoint.

Backups contain private financial data. Protect them with OS permissions and copy completed directories to protected offline storage using your own retention policy. Auth policy and credentials are excluded; maintain those separately. Interrupted backup directories without a registered checkpoint are incomplete and must not be used.

## Verify a restore

Choose a checkpoint and run an isolated restore. The server checks the trusted manifest hash and all file hashes before opening the copied database. SQLite integrity and foreign keys must pass. The ledger then replays and reconciles each portfolio's cash, quantities, lots, pending settlement, accounts and journal entries. A deterministic digest includes every immutable document revision, including issued reports. Required raw archive hashes must be present.

A verified attempt shows its new `recovery/<UUID>` directory. The running book stays unchanged. A failed attempt stays failed and never supplies a replacement path. Check available disk space and protect the incident evidence; do not repair bytes in an issued backup to make a hash pass.

## Promote a verified restore manually

1. Stop the API and browser development process so there are no new writes.
2. Preserve the current database, WAL and raw evidence for investigation.
3. Set private DATABASE_PATH to the verified restored directory's `book.sqlite`. The app uses that directory's `market-data` archive.
4. Keep the matching external AUTH_CONFIG_PATH and workspace scope; removing configured access is rejected.
5. Restart. Compare book checkpoints, cash, quantities, pending obligations, approvals and exact report revisions against the backup cutoff.
6. Reconcile subsequent external statements before resuming paper operations. Changes after the cutoff require an explicit reconciliation plan.

The drill really restores into a separate directory. Automatic replacement of a live book is intentionally absent. This is a single-process educational backup; distributed writers, encrypted remote backups, retention automation and disaster-recovery objectives require deployment-specific work. The OS owner is the trust boundary: a hash checkpoint is not a remote signed attestation.
