-- No-op. VACUUM only rewrites the file to reclaim free pages; it changes no
-- schema and no data, so there is nothing to reverse.
SELECT 1;
