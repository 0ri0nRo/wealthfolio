-- A missing account can be a sync parent that has not arrived yet. Preserve
-- source snapshots unless the account has a deletion tombstone; calculated
-- snapshots and daily valuations are rebuildable local data.
DELETE FROM holdings_snapshots
WHERE account_id NOT IN (SELECT id FROM accounts)
  AND (
      source = 'CALCULATED'
      OR account_id IN (
          SELECT entity_id FROM sync_entity_metadata
          WHERE entity = 'account' AND last_op = 'delete'
      )
  );

-- Migration connections disable foreign keys, so clean position rows explicitly.
DELETE FROM snapshot_positions
WHERE snapshot_id NOT IN (SELECT id FROM holdings_snapshots);

DELETE FROM daily_account_valuation
WHERE account_id NOT IN (SELECT id FROM accounts);

-- Sync may insert snapshots before their account, so a foreign key on account_id
-- would reject valid replay. A trigger covers both repository and direct SQL
-- account deletion without imposing an insertion order.
CREATE TRIGGER accounts_delete_portfolio_rows
AFTER DELETE ON accounts
BEGIN
    DELETE FROM holdings_snapshots WHERE account_id = OLD.id;
    DELETE FROM daily_account_valuation WHERE account_id = OLD.id;
END;
