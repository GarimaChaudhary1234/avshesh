-- Municipal officers are a new kind of user.
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('HOUSEHOLD', 'KABADIWALA', 'COMPOST', 'MUNICIPAL'));

-- Scrap dealer / compost center business profile and verification by the municipal corporation.
ALTER TABLE collectors
    ADD COLUMN business_name       VARCHAR(120),
    ADD COLUMN address             VARCHAR(255),
    ADD COLUMN vehicle_type        VARCHAR(20)   NOT NULL DEFAULT 'CYCLE_RICKSHAW',
    ADD COLUMN cost_per_km         NUMERIC(6, 2) NOT NULL DEFAULT 8,
    ADD COLUMN working_hours       VARCHAR(60),
    ADD COLUMN accepting_pickups   BOOLEAN       NOT NULL DEFAULT TRUE,
    ADD COLUMN verification_status VARCHAR(10)   NOT NULL DEFAULT 'PENDING'
        CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED'));

-- Places where households can hand in hazardous waste (batteries, bulbs, e-waste, medicines).
CREATE TABLE collection_points (
    id            BIGSERIAL PRIMARY KEY,
    name          VARCHAR(120)     NOT NULL,
    address       VARCHAR(255)     NOT NULL,
    lat           DOUBLE PRECISION NOT NULL,
    lng           DOUBLE PRECISION NOT NULL,
    accepts       VARCHAR(255)     NOT NULL,
    opening_hours VARCHAR(80),
    active        BOOLEAN          NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP        NOT NULL DEFAULT now()
);

-- Non-recyclable household waste that the municipal corporation has to collect.
CREATE TABLE municipal_requests (
    id            BIGSERIAL PRIMARY KEY,
    household_id  BIGINT        NOT NULL REFERENCES users (id),
    item_code     VARCHAR(40)   NOT NULL,
    est_kg        NUMERIC(8, 2) NOT NULL,
    note          VARCHAR(255),
    geohash       VARCHAR(12)   NOT NULL,
    status        VARCHAR(12)   NOT NULL DEFAULT 'OPEN'
        CHECK (status IN ('OPEN', 'SCHEDULED', 'COLLECTED', 'REJECTED')),
    scheduled_for DATE,
    created_at    TIMESTAMP     NOT NULL DEFAULT now(),
    resolved_at   TIMESTAMP
);
CREATE INDEX idx_municipal_requests_status ON municipal_requests (status);
CREATE INDEX idx_municipal_requests_household ON municipal_requests (household_id);
