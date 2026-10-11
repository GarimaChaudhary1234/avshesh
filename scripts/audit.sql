-- Consistency audit of the whole database: every row answers "how many rows break this rule?". All must be 0.
-- Run it with: node tests/api/audit.mjs   (or: docker compose exec -T db psql -U avshesh -d avshesh -f - < scripts/audit.sql)
-- Rule of thumb behind the checks: the finished stops (what the dealer weighed and paid) are the source of truth; the
-- impact figures, earnings and ward numbers must all be derivable from them and from nothing else.

WITH
done_stop AS (
    SELECT s.*, l.category AS listing_category, l.owner_id, p.collector_id
      FROM pickup_stops s
      JOIN listings l ON l.id = s.listing_id
      JOIN pickups p ON p.id = s.pickup_id
     WHERE s.done_at IS NOT NULL
)
SELECT 'impact: every finished collection has exactly one impact event' AS rule, count(*) AS violations
  FROM done_stop d WHERE (SELECT count(*) FROM impact_events e WHERE e.stop_id = d.id) <> 1
UNION ALL
SELECT 'impact: no event points at a missing or unfinished collection', count(*)
  FROM impact_events e LEFT JOIN pickup_stops s ON s.id = e.stop_id
 WHERE e.stop_id IS NOT NULL AND (s.id IS NULL OR s.done_at IS NULL)
UNION ALL
SELECT 'impact: event kg equals the weighed kg', count(*)
  FROM impact_events e JOIN pickup_stops s ON s.id = e.stop_id WHERE abs(e.kg_diverted - s.actual_kg) > 0.005
UNION ALL
SELECT 'impact: event payment equals the amount paid', count(*)
  FROM impact_events e JOIN pickup_stops s ON s.id = e.stop_id WHERE abs(e.paid_to_household - s.amount_paid) > 0.005
UNION ALL
SELECT 'impact: event pickup equals the stop pickup', count(*)
  FROM impact_events e JOIN pickup_stops s ON s.id = e.stop_id WHERE e.pickup_id IS DISTINCT FROM s.pickup_id
UNION ALL
SELECT 'impact: event category equals the listing category', count(*)
  FROM impact_events e JOIN pickup_stops s ON s.id = e.stop_id JOIN listings l ON l.id = s.listing_id WHERE e.category <> l.category
UNION ALL
SELECT 'impact: CO2 equals kg x the factor of the category (dry 1.5, wet 0.5)', count(*)
  FROM impact_events e JOIN pickup_stops s ON s.id = e.stop_id JOIN listings l ON l.id = s.listing_id
 WHERE abs(e.co2_saved_kg - round(s.actual_kg * CASE l.category WHEN 'DRY' THEN 1.5 WHEN 'WET' THEN 0.5 ELSE 0 END, 2)) > 0.011
UNION ALL
SELECT 'impact: compost made equals 25 % of the wet kg (0 for dry)', count(*)
  FROM impact_events e JOIN pickup_stops s ON s.id = e.stop_id JOIN listings l ON l.id = s.listing_id
 WHERE abs(e.composted_kg - CASE WHEN l.category = 'WET' THEN round(s.actual_kg * 0.25, 2) ELSE 0 END) > 0.011
UNION ALL
SELECT 'impact: the ward of an event is the ward of the home at that time (never empty for a home in a ward)', count(*)
  FROM impact_events e JOIN pickup_stops s ON s.id = e.stop_id JOIN listings l ON l.id = s.listing_id JOIN users u ON u.id = l.owner_id
 WHERE e.ward_id IS NULL AND u.ward_id IS NOT NULL

UNION ALL
SELECT 'stops: a finished stop has a positive weight, a payment, a mode and a written-down margin', count(*)
  FROM pickup_stops s WHERE s.done_at IS NOT NULL AND (s.actual_kg IS NULL OR s.actual_kg <= 0 OR s.amount_paid IS NULL OR s.amount_paid < 0 OR s.payment_mode IS NULL OR s.profit IS NULL)
UNION ALL
SELECT 'stops: the payment equals the kg times the buy rate written down on the stop', count(*)
  FROM pickup_stops s WHERE s.done_at IS NOT NULL AND (s.buy_rate IS NULL OR abs(s.amount_paid - round(s.actual_kg * s.buy_rate, 2)) > 0.011)
UNION ALL
SELECT 'stops: the margin equals the kg times (sell rate - buy rate) written down on the stop', count(*)
  FROM pickup_stops s WHERE s.done_at IS NOT NULL AND (s.sell_rate IS NULL OR abs(s.profit - round(s.actual_kg * (s.sell_rate - s.buy_rate), 2)) > 0.011)
UNION ALL
SELECT 'stops: an unfinished stop has no weight, payment or mode', count(*)
  FROM pickup_stops s WHERE s.done_at IS NULL AND (s.actual_kg IS NOT NULL OR s.amount_paid IS NOT NULL OR s.payment_mode IS NOT NULL OR s.profit IS NOT NULL OR s.buy_rate IS NOT NULL)
UNION ALL
SELECT 'stops: the payment is never more than the weight times the best rate in the catalog (no absurd amounts)', count(*)
  FROM pickup_stops s WHERE s.done_at IS NOT NULL AND s.amount_paid > s.actual_kg * 200
UNION ALL
SELECT 'payments: an unfinished stop is PENDING', count(*)
  FROM pickup_stops s WHERE s.done_at IS NULL AND s.payment_status <> 'PENDING'
UNION ALL
SELECT 'payments: DISPUTED has the household note; CONFIRMED has its time; RESOLVED has note and time', count(*)
  FROM pickup_stops s WHERE (s.payment_status = 'DISPUTED' AND s.dispute_note IS NULL)
    OR (s.payment_status = 'CONFIRMED' AND s.confirmed_at IS NULL)
    OR (s.payment_status = 'RESOLVED' AND (s.resolution_note IS NULL OR s.resolved_at IS NULL))

UNION ALL
SELECT 'listings: a DONE listing has a finished stop, and a finished stop makes its listing DONE', count(*)
  FROM listings l WHERE (l.status = 'DONE') <> EXISTS (SELECT 1 FROM pickup_stops s WHERE s.listing_id = l.id AND s.done_at IS NOT NULL)
UNION ALL
SELECT 'listings: a SCHEDULED listing has an unfinished stop; an OPEN listing has no stop', count(*)
  FROM listings l WHERE (l.status = 'SCHEDULED' AND NOT EXISTS (SELECT 1 FROM pickup_stops s WHERE s.listing_id = l.id AND s.done_at IS NULL))
    OR (l.status = 'OPEN' AND EXISTS (SELECT 1 FROM pickup_stops s WHERE s.listing_id = l.id))
UNION ALL
SELECT 'listings: a listing is on at most one stop', count(*)
  FROM (SELECT listing_id FROM pickup_stops GROUP BY listing_id HAVING count(*) > 1) x
UNION ALL
SELECT 'pickups: a pickup has stops, and is DONE exactly when all its stops are finished', count(*)
  FROM pickups p WHERE NOT EXISTS (SELECT 1 FROM pickup_stops s WHERE s.pickup_id = p.id)
    OR (p.status = 'DONE') <> NOT EXISTS (SELECT 1 FROM pickup_stops s WHERE s.pickup_id = p.id AND s.done_at IS NULL)
UNION ALL
SELECT 'pickups: the stops of a pickup are numbered 1..n without gaps', count(*)
  FROM (SELECT pickup_id FROM pickup_stops GROUP BY pickup_id HAVING min(seq) <> 1 OR max(seq) <> count(*)) x
UNION ALL
SELECT 'pools: a pool with a pickup is ACCEPTED or DONE, DONE exactly when the pickup is, and has the same collector', count(*)
  FROM pools po JOIN pickups p ON p.pool_id = po.id
 WHERE po.status NOT IN ('ACCEPTED', 'DONE') OR (po.status = 'DONE') <> (p.status = 'DONE') OR po.collector_id IS DISTINCT FROM p.collector_id
UNION ALL
SELECT 'pools: an ACCEPTED or DONE pool has a pickup; an open pool has none', count(*)
  FROM pools po WHERE (po.status IN ('ACCEPTED', 'DONE')) <> EXISTS (SELECT 1 FROM pickups p WHERE p.pool_id = po.id)
UNION ALL
SELECT 'pools: the stored kg equals the kg of the listings in the pool', count(*)
  FROM pools po WHERE abs(po.total_kg - coalesce((SELECT sum(l.est_kg) FROM listings l WHERE l.pool_id = po.id), 0)) > 0.011
UNION ALL
SELECT 'pools: every listing of a pool has the pool waste type', count(*)
  FROM listings l JOIN pools po ON po.id = l.pool_id WHERE po.waste_type <> l.category

UNION ALL
SELECT 'requests: SCHEDULED has a worker and a date; OPEN has neither', count(*)
  FROM municipal_requests r WHERE (r.status = 'SCHEDULED' AND (r.staff_id IS NULL OR r.scheduled_for IS NULL))
    OR (r.status = 'OPEN' AND (r.staff_id IS NOT NULL OR r.scheduled_for IS NOT NULL))
UNION ALL
SELECT 'requests: COLLECTED and REJECTED have a finish time, the others none', count(*)
  FROM municipal_requests r WHERE (r.status IN ('COLLECTED', 'REJECTED')) <> (r.resolved_at IS NOT NULL)
UNION ALL
SELECT 'requests: the worker belongs to the same ward as the request', count(*)
  FROM municipal_requests r JOIN municipal_staff s ON s.id = r.staff_id WHERE s.ward_id IS DISTINCT FROM r.ward_id

UNION ALL
SELECT 'staff: a worker with a login is a FIELD_STAFF user of the same ward with the same active flag', count(*)
  FROM municipal_staff s JOIN users u ON u.id = s.user_id WHERE u.role <> 'FIELD_STAFF' OR u.ward_id IS DISTINCT FROM s.ward_id OR u.active <> s.active
UNION ALL
SELECT 'staff: every FIELD_STAFF user has exactly one worker record', count(*)
  FROM users u WHERE u.role = 'FIELD_STAFF' AND (SELECT count(*) FROM municipal_staff s WHERE s.user_id = u.id) <> 1
UNION ALL
SELECT 'users: a ward officer has a ward that exists; every household and collector has a location', count(*)
  FROM users u WHERE (u.role = 'MUNICIPAL' AND u.ward_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM wards w WHERE w.id = u.ward_id))
    OR (u.role IN ('HOUSEHOLD', 'KABADIWALA', 'COMPOST') AND (u.lat IS NULL OR u.lng IS NULL))
UNION ALL
SELECT 'ratings: a rating is for a finished stop, by the owner of the listing, about the dealer who collected it', count(*)
  FROM ratings r WHERE NOT EXISTS (
        SELECT 1 FROM pickup_stops s JOIN listings l ON l.id = s.listing_id JOIN pickups p ON p.id = s.pickup_id
         WHERE s.listing_id = r.listing_id AND s.done_at IS NOT NULL AND l.owner_id = r.household_id AND p.collector_id = r.collector_id)
UNION ALL
SELECT 'ratings: the weight is between 0 and 1', count(*)
  FROM ratings r WHERE r.weight <= 0 OR r.weight > 1
UNION ALL
SELECT 'activity: only officers and workers write the activity log, and the ward exists', count(*)
  FROM municipal_activity a JOIN users u ON u.id = a.actor_id
 WHERE u.role NOT IN ('MUNICIPAL', 'FIELD_STAFF') OR (a.ward_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM wards w WHERE w.id = a.ward_id))
ORDER BY 1;
