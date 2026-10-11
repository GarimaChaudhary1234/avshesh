-- Ward and city totals are sums over impact_events: an index on the ward column keeps them fast as events grow.
CREATE INDEX IF NOT EXISTS idx_impact_events_ward ON impact_events (ward_id);
