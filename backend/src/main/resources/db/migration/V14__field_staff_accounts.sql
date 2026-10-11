-- The municipal collection workers get their own login (role FIELD_STAFF): they see the pickups assigned to them
-- and mark them collected.
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('HOUSEHOLD', 'KABADIWALA', 'COMPOST', 'MUNICIPAL', 'FIELD_STAFF'));

-- A staff record that has a login points at its user account (older records have none).
ALTER TABLE municipal_staff ADD COLUMN user_id BIGINT REFERENCES users (id);
CREATE UNIQUE INDEX uq_municipal_staff_user ON municipal_staff (user_id) WHERE user_id IS NOT NULL;
