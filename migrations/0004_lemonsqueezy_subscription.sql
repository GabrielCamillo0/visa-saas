-- Campos para Lemon Squeezy (assinatura/plano)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS lemon_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS lemon_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT;

COMMENT ON COLUMN users.subscription_status IS 'active, cancelled, past_due, unpaid, ou null';
