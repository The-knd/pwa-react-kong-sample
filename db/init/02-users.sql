-- Esquema de users_db (dominio: usuarios y credenciales).
-- Usado por auth-service (credenciales + refresh tokens) y users-service (CRUD admin).
\connect users_db

CREATE TYPE user_role AS ENUM ('admin', 'vendedor');

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(50) NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    role          user_role   NOT NULL DEFAULT 'vendedor',
    active        BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash CHAR(64)    NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);

-- Usuarios seed (SOLO desarrollo): admin/admin123 y vendedor/vendedor123
INSERT INTO users (username, password_hash, role) VALUES
    ('admin',    '$2a$10$EG5Q6hTFsR0/aDwUKtPipONS5yMi6AcrgwjDycXHSlqtnv.QKwA2y', 'admin'),
    ('vendedor', '$2a$10$2/Vjw8E5C0qvwTEoN3ydLO/91QFoC5qTpJCtN4wDpWu/8u7xD/hDa', 'vendedor');

GRANT USAGE ON SCHEMA public TO pos_app;
GRANT ALL ON ALL TABLES IN SCHEMA public TO pos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO pos_app;
