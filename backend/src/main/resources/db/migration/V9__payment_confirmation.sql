-- After a stop is paid the household confirms (or disputes) that they received the money. A dispute goes to the
-- municipal officer of the household's ward.
ALTER TABLE pickup_stops
    ADD COLUMN payment_status   VARCHAR(10) NOT NULL DEFAULT 'PENDING'
        CHECK (payment_status IN ('PENDING', 'CONFIRMED', 'DISPUTED', 'RESOLVED')),
    ADD COLUMN dispute_note     VARCHAR(255),
    ADD COLUMN confirmed_at     TIMESTAMP,
    ADD COLUMN resolution_note  VARCHAR(255),
    ADD COLUMN resolved_at      TIMESTAMP;
CREATE INDEX idx_pickup_stops_payment ON pickup_stops (payment_status);
