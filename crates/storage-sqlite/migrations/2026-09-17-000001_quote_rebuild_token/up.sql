-- Keep a pending explicit-history rebuild dirty when any quote writer changes data.
-- This key is local-only and owned by PENDING_QUOTE_REBUILD_KEY in core.
CREATE TRIGGER quotes_pending_rebuild_insert
AFTER INSERT ON quotes
WHEN EXISTS (SELECT 1 FROM app_settings WHERE setting_key = 'quote_history.pending_rebuild')
BEGIN
    UPDATE app_settings SET setting_value = lower(hex(randomblob(16)))
    WHERE setting_key = 'quote_history.pending_rebuild';
END;
CREATE TRIGGER quotes_pending_rebuild_update
AFTER UPDATE ON quotes
WHEN EXISTS (SELECT 1 FROM app_settings WHERE setting_key = 'quote_history.pending_rebuild')
BEGIN
    UPDATE app_settings SET setting_value = lower(hex(randomblob(16)))
    WHERE setting_key = 'quote_history.pending_rebuild';
END;
CREATE TRIGGER quotes_pending_rebuild_delete
AFTER DELETE ON quotes
WHEN EXISTS (SELECT 1 FROM app_settings WHERE setting_key = 'quote_history.pending_rebuild')
BEGIN
    UPDATE app_settings SET setting_value = lower(hex(randomblob(16)))
    WHERE setting_key = 'quote_history.pending_rebuild';
END;
