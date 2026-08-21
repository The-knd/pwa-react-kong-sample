-- Esquema de clients_db (dominio: clientes)
\connect clients_db

CREATE TYPE doc_type AS ENUM ('CC', 'CE', 'NIT', 'PAS');

CREATE TABLE clients (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_type    doc_type     NOT NULL,
    doc_number  VARCHAR(20)  NOT NULL,
    name        VARCHAR(120) NOT NULL,
    phone       VARCHAR(20),
    email       VARCHAR(120),
    address     VARCHAR(200),
    created_by  UUID         NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (doc_type, doc_number)
);

CREATE INDEX idx_clients_name ON clients (name);

GRANT USAGE ON SCHEMA public TO pos_app;
GRANT ALL ON ALL TABLES IN SCHEMA public TO pos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO pos_app;
