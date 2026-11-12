# Index rollout for existing databases

`User` now declares a unique index on student IDs for student accounts, and
`Ledger` declares a unique index on student IDs. These indexes stop concurrent
first-payment updates from creating duplicate ledgers and stop two student
accounts from sharing payment ownership.

Before deploying, back up the database and run `node scripts/auditIndexes.js`
from `server/` with the normal `MONGO_URI`. The script reads only and reports
duplicate group counts without printing student identifiers. If a count is
nonzero, inspect the affected records with a restricted database account and
reconcile them against payment history before building indexes. Do not merge
or delete records automatically. Repeat the audit until both counts are zero.

Deploy to a MongoDB replica set or sharded cluster: payment approval and direct
payment now use multi-document transactions. A standalone MongoDB server does
not support those transactions. Test one approval and one rejection in staging
before using the cashier workflow in production.

Rollback: restore the previous application version first. These indexes do not
change record contents; if an index must be removed after rollback, drop only
`uniq_student_account_id` and/or `uniq_ledger_student_id` after confirming the previous application is
active and after taking a fresh backup. Do not roll back approved payments or
ledger balances by deleting records.
