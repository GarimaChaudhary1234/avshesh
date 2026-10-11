-- A commissioner can switch an account off (a ward officer who left, for example).
ALTER TABLE users ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;

-- What officers did, per ward, so the commissioner can see how each ward is being run.
CREATE TABLE municipal_activity (
    id         BIGSERIAL PRIMARY KEY,
    actor_id   BIGINT       NOT NULL REFERENCES users (id),
    ward_id    BIGINT       REFERENCES wards (id),
    code       VARCHAR(40)  NOT NULL,
    detail     VARCHAR(200),
    created_at TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE INDEX idx_municipal_activity_ward ON municipal_activity (ward_id, created_at DESC);
CREATE INDEX idx_municipal_activity_actor ON municipal_activity (actor_id, created_at DESC);
