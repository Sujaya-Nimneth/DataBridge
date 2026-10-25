-- Seed data for the demo source database (PostgreSQL).
CREATE TABLE customers (
    id           INTEGER PRIMARY KEY,
    name         VARCHAR(120) NOT NULL,
    email        VARCHAR(180) NOT NULL,
    country      VARCHAR(2) NOT NULL,
    score        INTEGER NOT NULL,
    signed_up_at TIMESTAMP NOT NULL
);

INSERT INTO customers (id, name, email, country, score, signed_up_at)
SELECT
    i,
    'Customer ' || i,
    'customer' || i || '@example.com',
    (ARRAY['US', 'DE', 'IN', 'BR', 'JP'])[1 + (i % 5)],
    (i * 7) % 101,
    TIMESTAMP '2026-01-01' + (i || ' hours')::interval
FROM generate_series(1, 2000) AS i;

CREATE INDEX idx_customers_country ON customers (country);

ANALYZE customers;
