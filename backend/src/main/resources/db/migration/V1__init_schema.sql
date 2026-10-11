CREATE TABLE users (
    id          BIGSERIAL PRIMARY KEY,
    role        VARCHAR(20)  NOT NULL CHECK (role IN ('HOUSEHOLD','KABADIWALA','COMPOST')),
    name        VARCHAR(100) NOT NULL,
    phone       VARCHAR(15)  NOT NULL UNIQUE,
    lat         DOUBLE PRECISION,
    lng         DOUBLE PRECISION,
    geohash     VARCHAR(12),
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE collectors (
    user_id            BIGINT PRIMARY KEY REFERENCES users(id),
    service_radius_km  NUMERIC(5,1) NOT NULL DEFAULT 5,
    min_trip_profit    NUMERIC(10,2) NOT NULL DEFAULT 200,
    min_load_kg        NUMERIC(8,1) NOT NULL DEFAULT 0,
    daily_capacity_kg  NUMERIC(8,1)
);

CREATE TABLE rate_cards (
    id            BIGSERIAL PRIMARY KEY,
    collector_id  BIGINT NOT NULL REFERENCES collectors(user_id),
    item_code     VARCHAR(40) NOT NULL,
    buy_rate      NUMERIC(8,2) NOT NULL,   -- Rs/kg collector pays household
    sell_rate     NUMERIC(8,2) NOT NULL,   -- Rs/kg collector sells onward
    UNIQUE (collector_id, item_code)
);

CREATE TABLE pools (
    id            BIGSERIAL PRIMARY KEY,
    name          VARCHAR(120) NOT NULL,
    geohash       VARCHAR(12) NOT NULL,
    waste_type    VARCHAR(10) NOT NULL CHECK (waste_type IN ('DRY','WET')),
    status        VARCHAR(12) NOT NULL DEFAULT 'FILLING'
                  CHECK (status IN ('FILLING','READY','ACCEPTED','DONE')),
    total_kg      NUMERIC(10,2) NOT NULL DEFAULT 0,
    est_profit    NUMERIC(10,2) NOT NULL DEFAULT 0,
    collector_id  BIGINT REFERENCES collectors(user_id),
    created_at    TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_pools_geohash_status ON pools (geohash, waste_type, status);

CREATE TABLE listings (
    id          BIGSERIAL PRIMARY KEY,
    owner_id    BIGINT NOT NULL REFERENCES users(id),
    item_code   VARCHAR(40) NOT NULL,
    category    VARCHAR(10) NOT NULL CHECK (category IN ('DRY','WET','EWASTE')),
    est_kg      NUMERIC(8,2) NOT NULL,
    ready_from  DATE NOT NULL,
    photo_key   VARCHAR(255),
    mode        VARCHAR(10) NOT NULL CHECK (mode IN ('POOL','SELF_DROP')),
    pool_id     BIGINT REFERENCES pools(id),
    status      VARCHAR(12) NOT NULL DEFAULT 'OPEN',
    created_at  TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_listings_pool ON listings (pool_id);
CREATE INDEX idx_listings_owner ON listings (owner_id);

CREATE TABLE pickups (
    id               BIGSERIAL PRIMARY KEY,
    pool_id          BIGINT NOT NULL REFERENCES pools(id),
    collector_id     BIGINT NOT NULL REFERENCES collectors(user_id),
    scheduled_start  TIMESTAMP NOT NULL,
    scheduled_end    TIMESTAMP NOT NULL,
    status           VARCHAR(12) NOT NULL DEFAULT 'SCHEDULED'
);

CREATE TABLE pickup_stops (
    id            BIGSERIAL PRIMARY KEY,
    pickup_id     BIGINT NOT NULL REFERENCES pickups(id),
    listing_id    BIGINT NOT NULL REFERENCES listings(id),
    seq           INT NOT NULL,
    otp           VARCHAR(6) NOT NULL,
    actual_kg     NUMERIC(8,2),
    amount_paid   NUMERIC(10,2),
    payment_mode  VARCHAR(5) CHECK (payment_mode IN ('CASH','UPI')),
    done_at       TIMESTAMP
);

CREATE TABLE impact_events (
    id                 BIGSERIAL PRIMARY KEY,
    area_geohash       VARCHAR(12) NOT NULL,
    category           VARCHAR(10) NOT NULL,
    kg_diverted        NUMERIC(10,2) NOT NULL,
    co2_saved_kg       NUMERIC(10,2) NOT NULL,
    composted_kg       NUMERIC(10,2) NOT NULL DEFAULT 0,
    paid_to_household  NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at         TIMESTAMP NOT NULL DEFAULT now()
);
