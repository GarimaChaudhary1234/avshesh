-- Safety net: a mohalla can have only one open pool per waste type. The application already queues
-- concurrent listings with an advisory lock; this makes the database refuse a duplicate even if that ever fails.
CREATE UNIQUE INDEX uq_pools_open_cell ON pools (geohash, waste_type) WHERE status IN ('FILLING', 'READY');
