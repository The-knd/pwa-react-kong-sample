-- Esquema de sales_db (dominio: ventas). `products` vive aquí como catálogo
-- seed hasta que tenga su propio microservicio (fase 2).
\connect sales_db

CREATE TABLE products (
    id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku   VARCHAR(30)  NOT NULL UNIQUE,
    name  VARCHAR(120) NOT NULL,
    price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    stock INTEGER      NOT NULL DEFAULT 0 CHECK (stock >= 0)
);

INSERT INTO products (sku, name, price, stock) VALUES
    ('SKU-001', 'Arroz Diana 500g',      2500.00, 100),
    ('SKU-002', 'Aceite Girasol 1L',     8900.00,  50),
    ('SKU-003', 'Azúcar Blanca 1kg',     3200.00,  80),
    ('SKU-004', 'Panela Redonda 500g',   2800.00,  40),
    ('SKU-005', 'Café Ground 250g',     12500.00,  30),
    ('SKU-006', 'Leche Entera 1L',       3900.00,  60);

CREATE TYPE sale_status AS ENUM ('completed', 'voided');

CREATE TABLE sales (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID           NOT NULL,
    seller_id UUID           NOT NULL,
    total     NUMERIC(12,2)  NOT NULL CHECK (total >= 0),
    status    sale_status    NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_created_at ON sales (created_at DESC);
CREATE INDEX idx_sales_seller_id  ON sales (seller_id);

CREATE TABLE sale_items (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id    UUID          NOT NULL REFERENCES sales (id) ON DELETE CASCADE,
    product_id UUID          NOT NULL REFERENCES products (id),
    quantity   INTEGER       NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0)
);

CREATE INDEX idx_sale_items_sale_id ON sale_items (sale_id);

GRANT USAGE ON SCHEMA public TO pos_app;
GRANT ALL ON ALL TABLES IN SCHEMA public TO pos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO pos_app;
