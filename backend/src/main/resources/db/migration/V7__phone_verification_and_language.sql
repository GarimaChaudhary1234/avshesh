-- A phone number must be proven (by an SMS code) before an account can list waste, accept pools or rate.
ALTER TABLE users ADD COLUMN phone_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN language VARCHAR(5) NOT NULL DEFAULT 'en';
-- SHA-256 of the address the account was created from: lets ratings from accounts that share a network be weighed lower.
ALTER TABLE users ADD COLUMN registered_ip_hash VARCHAR(64);
-- Officers are created by the operator, not by a visitor, so their number counts as proven.
UPDATE users SET phone_verified = TRUE WHERE role = 'MUNICIPAL';

CREATE TABLE phone_codes (
    id         BIGSERIAL PRIMARY KEY,
    phone      VARCHAR(15)  NOT NULL,
    purpose    VARCHAR(10)  NOT NULL CHECK (purpose IN ('VERIFY', 'RESET')),
    code_hash  VARCHAR(100) NOT NULL,
    expires_at TIMESTAMP    NOT NULL,
    consumed   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP    NOT NULL DEFAULT now()
);
CREATE INDEX idx_phone_codes_lookup ON phone_codes (phone, purpose, consumed);
