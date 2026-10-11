-- In-app notification inbox. The text is stored already translated into the user's language.
CREATE TABLE notifications (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES users (id),
    code       VARCHAR(60)  NOT NULL,
    message    VARCHAR(500) NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT now(),
    read_at    TIMESTAMP
);
CREATE INDEX idx_notifications_user ON notifications (user_id, id DESC);
