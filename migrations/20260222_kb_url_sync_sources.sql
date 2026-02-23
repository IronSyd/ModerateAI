-- Managed knowledge base URL crawl/sync sources and run history

CREATE TABLE IF NOT EXISTS knowledge_url_sources (
  id serial PRIMARY KEY,
  knowledge_base_id integer NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  workspace_owner_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text,
  seed_url text NOT NULL,
  host text NOT NULL,
  path_prefix text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  sync_mode text NOT NULL DEFAULT 'manual',
  schedule_recurrence text,
  schedule_days_of_week integer[],
  schedule_time text,
  schedule_timezone text,
  last_run_at timestamp,
  last_success_at timestamp,
  last_run_status text,
  last_error text,
  created_by_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_by_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS knowledge_url_sources_kb_host_path_prefix_unique
  ON knowledge_url_sources (knowledge_base_id, host, path_prefix);
CREATE INDEX IF NOT EXISTS knowledge_url_sources_kb_status_idx
  ON knowledge_url_sources (knowledge_base_id, status);
CREATE INDEX IF NOT EXISTS knowledge_url_sources_owner_status_idx
  ON knowledge_url_sources (workspace_owner_id, status);
CREATE INDEX IF NOT EXISTS knowledge_url_sources_sync_mode_status_idx
  ON knowledge_url_sources (sync_mode, status);

CREATE TABLE IF NOT EXISTS knowledge_url_sync_runs (
  id serial PRIMARY KEY,
  source_id integer NOT NULL REFERENCES knowledge_url_sources(id) ON DELETE CASCADE,
  knowledge_base_id integer NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  workspace_owner_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  triggered_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  trigger_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  started_at timestamp,
  completed_at timestamp,
  pages_discovered integer NOT NULL DEFAULT 0,
  pages_fetched integer NOT NULL DEFAULT 0,
  pages_created integer NOT NULL DEFAULT 0,
  pages_updated integer NOT NULL DEFAULT 0,
  pages_unchanged integer NOT NULL DEFAULT 0,
  pages_marked_stale integer NOT NULL DEFAULT 0,
  pages_skipped integer NOT NULL DEFAULT 0,
  errors_count integer NOT NULL DEFAULT 0,
  warnings_count integer NOT NULL DEFAULT 0,
  summary jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_url_sync_runs_source_created_idx
  ON knowledge_url_sync_runs (source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS knowledge_url_sync_runs_owner_created_idx
  ON knowledge_url_sync_runs (workspace_owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS knowledge_url_sync_runs_status_created_idx
  ON knowledge_url_sync_runs (status, created_at DESC);

