-- Hybrid bot ownership rollout (app-owned default + Pro BYOB)

ALTER TABLE platforms
ADD COLUMN IF NOT EXISTS bot_ownership_mode text NOT NULL DEFAULT 'app_owned';

CREATE TABLE IF NOT EXISTS integration_claim_codes (
  id serial PRIMARY KEY,
  platform_id integer NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  workspace_owner_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform_type text NOT NULL,
  code text NOT NULL UNIQUE,
  created_by_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamp NOT NULL,
  used_at timestamp,
  used_external_id text,
  used_by_platform_user_id text,
  revoked_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS integration_claim_codes_platform_active_idx
  ON integration_claim_codes (platform_id, used_at, revoked_at, expires_at);

CREATE INDEX IF NOT EXISTS integration_claim_codes_code_idx
  ON integration_claim_codes (code);
