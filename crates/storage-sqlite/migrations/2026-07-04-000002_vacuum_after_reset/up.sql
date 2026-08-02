-- Reclaim the disk space freed by the derived-read-model reset (000001).
--
-- Deleting the CALCULATED snapshots releases their pages to SQLite's freelist
-- but does not shrink the database file; on a large instance that is hundreds
-- of megabytes the file keeps. VACUUM rewrites the file so the space is
-- actually returned to the filesystem.
--
-- This lives in its own migration because VACUUM cannot run inside a
-- transaction (see metadata.toml). Keeping 000001 transactional preserves its
-- atomicity: it contains ALTER TABLE ... ADD COLUMN statements that would fail
-- on a re-run if a crash left it recorded as unapplied. VACUUM is idempotent,
-- so re-running this one after a crash is harmless.

-- `run_migrations` sets `synchronous = OFF` for the migration connection, which
-- is not safe to hold across a VACUUM: VACUUM rewrites the whole database file,
-- so an OS crash or power loss mid-rewrite can corrupt it rather than losing
-- just the in-flight migration. Restore full durability for the rewrite, then
-- hand back to the caller, which resets the connection pragmas (to
-- `synchronous = NORMAL`) once migrations finish.
PRAGMA synchronous = FULL;
VACUUM;
