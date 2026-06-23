-- Stripe billing — adds the customer link required by checkout.
-- Idempotent: ALTER ADD COLUMN errors on re-run, but D1 migrations run once.
-- users.plan already exists from 0004_email.sql (default 'free').
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users (stripe_customer_id);
