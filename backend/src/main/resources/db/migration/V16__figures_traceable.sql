-- Every impact event now says which collection it came from, so the figures can be checked against the stops they are
-- made from, and so that "pickups" (trips) and "home collections" (stops) are told apart.
ALTER TABLE impact_events ADD COLUMN stop_id   BIGINT REFERENCES pickup_stops (id);
ALTER TABLE impact_events ADD COLUMN pickup_id BIGINT REFERENCES pickups (id);
-- A stop can be counted once, never twice.
CREATE UNIQUE INDEX uq_impact_events_stop ON impact_events (stop_id) WHERE stop_id IS NOT NULL;

-- The rates of a stop are written down when it is done: what the dealer paid per kg, what the dealer resells for, and
-- from them the payment and the margin. Both used to be worked out from today's rate card, so editing a rate changed
-- the earnings of pickups that had already happened, and nothing could prove a payment was right.
ALTER TABLE pickup_stops ADD COLUMN buy_rate  NUMERIC(8, 2);
ALTER TABLE pickup_stops ADD COLUMN sell_rate NUMERIC(8, 2);
ALTER TABLE pickup_stops ADD COLUMN profit    NUMERIC(10, 2);
-- Finished stops of an older database: the rate paid is what was paid per kg; the resale rate comes from the rate card.
UPDATE pickup_stops s
   SET buy_rate = ROUND(s.amount_paid / s.actual_kg, 2)
 WHERE s.done_at IS NOT NULL AND s.actual_kg > 0;
UPDATE pickup_stops s
   SET sell_rate = COALESCE(rc.sell_rate, s.buy_rate)
  FROM pickups p, listings l
  LEFT JOIN rate_cards rc ON rc.item_code = l.item_code
 WHERE s.done_at IS NOT NULL AND p.id = s.pickup_id AND l.id = s.listing_id AND rc.collector_id = p.collector_id;
UPDATE pickup_stops SET sell_rate = buy_rate WHERE done_at IS NOT NULL AND sell_rate IS NULL;
UPDATE pickup_stops SET profit = ROUND(actual_kg * (sell_rate - buy_rate), 2) WHERE done_at IS NOT NULL;
