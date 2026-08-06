-- Repair activities that were persisted with an empty currency (#1388).
--
-- When a CSV had no currency column, the import review step resolved the account
-- currency for display, but the confirm step sent the currency back as '' (the
-- row is still `currencySource: "default"` in the import UI) and the apply path
-- only filled the blank in for cash movements. Asset-backed rows were stored
-- with currency = '', which then fails FX conversion ('' -> CAD) when valuation
-- runs. `ActivityService::normalize_for_insert` now fills the blank in for every
-- row; this migration heals the rows written before that.

-- 1. Clear the derived read models for the affected accounts. This has to run
--    BEFORE the UPDATE below, while the broken rows are still identifiable.
--    These models were calculated from activities whose currency could not be
--    converted, and an append-only rebuild would keep reusing those numbers.
--    The portfolio calculation path regenerates them from the repaired
--    activities: startup backfill detection schedules the recalculation when an
--    account has activities but no valuations. Accounts with no affected
--    activities are left untouched, so unaffected installs do no work here.
DELETE FROM lot_disposals
WHERE account_id IN (
    SELECT DISTINCT account_id FROM activities WHERE TRIM(currency) = ''
);

DELETE FROM lots
WHERE account_id IN (
    SELECT DISTINCT account_id FROM activities WHERE TRIM(currency) = ''
);

DELETE FROM daily_account_valuation
WHERE account_id IN (
    SELECT DISTINCT account_id FROM activities WHERE TRIM(currency) = ''
);

DELETE FROM holdings_snapshots
WHERE source = 'CALCULATED'
  AND account_id IN (
      SELECT DISTINCT account_id FROM activities WHERE TRIM(currency) = ''
  );

-- 2. Drop the position rows orphaned by step 1. Migrations run with
--    `PRAGMA foreign_keys = OFF`, so the ON DELETE CASCADE from
--    holdings_snapshots does not fire here.
DELETE FROM snapshot_positions
WHERE snapshot_id NOT IN (SELECT id FROM holdings_snapshots);

-- 3. Fill the blank currency in from the owning account. This is the same value
--    the review step displayed and the same value the import path now stores, so
--    a row imported before this fix ends up with the currency it would get
--    today. Rows whose account carries no currency of its own are left as-is
--    rather than given a guessed one.
UPDATE activities
SET currency = (
        SELECT accounts.currency
        FROM accounts
        WHERE accounts.id = activities.account_id
    )
WHERE TRIM(currency) = ''
  AND EXISTS (
      SELECT 1
      FROM accounts
      WHERE accounts.id = activities.account_id
        AND TRIM(accounts.currency) <> ''
  );
