-- Real municipal wards (polygons are loaded from data/*.tsv at startup).
CREATE TABLE wards (
    id         BIGSERIAL PRIMARY KEY,
    city       VARCHAR(60)      NOT NULL,
    ward_no    VARCHAR(10)      NOT NULL,
    zone       VARCHAR(60),
    households INT,
    population INT,
    boundary   TEXT             NOT NULL,   -- rings of "lng lat,lng lat,..." separated by "|"; first ring is the outer one
    min_lat    DOUBLE PRECISION NOT NULL,
    max_lat    DOUBLE PRECISION NOT NULL,
    min_lng    DOUBLE PRECISION NOT NULL,
    max_lng    DOUBLE PRECISION NOT NULL,
    UNIQUE (city, ward_no)
);

-- Everything that belongs to a place now knows its ward. NULL means "outside every known ward".
-- For a MUNICIPAL user, a NULL ward means a city-wide commissioner who sees every ward.
ALTER TABLE users              ADD COLUMN ward_id BIGINT REFERENCES wards (id);
ALTER TABLE pools              ADD COLUMN ward_id BIGINT REFERENCES wards (id);
ALTER TABLE impact_events      ADD COLUMN ward_id BIGINT REFERENCES wards (id);
ALTER TABLE collection_points  ADD COLUMN ward_id BIGINT REFERENCES wards (id);
ALTER TABLE municipal_requests ADD COLUMN ward_id BIGINT REFERENCES wards (id);
CREATE INDEX idx_users_ward ON users (ward_id);
CREATE INDEX idx_requests_ward ON municipal_requests (ward_id);

-- Collection staff of a ward, assigned to waste pickup requests.
CREATE TABLE municipal_staff (
    id      BIGSERIAL PRIMARY KEY,
    ward_id BIGINT       NOT NULL REFERENCES wards (id),
    name    VARCHAR(100) NOT NULL,
    phone   VARCHAR(15)  NOT NULL,
    active  BOOLEAN      NOT NULL DEFAULT TRUE
);
ALTER TABLE municipal_requests ADD COLUMN staff_id BIGINT REFERENCES municipal_staff (id);

-- Households rate a scrap dealer or compost center after a completed pickup.
CREATE TABLE ratings (
    id           BIGSERIAL PRIMARY KEY,
    listing_id   BIGINT    NOT NULL UNIQUE REFERENCES listings (id),
    household_id BIGINT    NOT NULL REFERENCES users (id),
    collector_id BIGINT    NOT NULL REFERENCES collectors (user_id),
    stars        INT       NOT NULL CHECK (stars BETWEEN 1 AND 5),
    comment      VARCHAR(255),
    created_at   TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_ratings_collector ON ratings (collector_id);
