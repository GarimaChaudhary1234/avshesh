-- Ratings carry a weight so that suspicious ones count less: from a household that registered from the same
-- network as the dealer, or one of many from the same network in a month. The hash is of the address only.
ALTER TABLE ratings ADD COLUMN weight NUMERIC(3, 2) NOT NULL DEFAULT 1;
ALTER TABLE ratings ADD COLUMN household_ip_hash VARCHAR(64);
