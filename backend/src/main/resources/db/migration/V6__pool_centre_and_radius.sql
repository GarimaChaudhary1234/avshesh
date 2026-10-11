-- A pool now covers the homes within a walking distance of its centre instead of one map cell, so two neighbours
-- on either side of a cell edge are no longer split into separate pools. Concurrent listings are queued by an
-- advisory lock per waste type, so the one-pool-per-cell index is not needed any more.
DROP INDEX IF EXISTS uq_pools_open_cell;
ALTER TABLE pools ADD COLUMN center_lat DOUBLE PRECISION;
ALTER TABLE pools ADD COLUMN center_lng DOUBLE PRECISION;
CREATE INDEX idx_pools_open_type ON pools (waste_type, status);
