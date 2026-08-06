-- No-op reversal. The up migration only repairs data: it cannot restore the
-- empty currency values it replaced (the original '' carried no information to
-- restore), and the derived read models it cleared are rebuilt from the source
-- activities by the portfolio calculation path rather than by this migration.
SELECT 1;
