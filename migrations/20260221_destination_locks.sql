create table if not exists destination_locks (
  id serial primary key,
  chat_configuration_id integer not null references chat_configurations(id) on delete cascade,
  platform_id integer not null references platforms(id) on delete cascade,
  platform_type text not null,
  destination_external_id text not null,
  status text not null default 'active',
  source text not null,
  reason text,
  requested_by_user_id integer references users(id) on delete set null,
  requested_by_platform_user_id text,
  requested_by_platform_username text,
  started_at timestamp not null,
  ends_at timestamp not null,
  released_at timestamp,
  release_reason text,
  permission_snapshot jsonb not null default '{}'::jsonb,
  notice_channel_external_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create index if not exists destination_locks_chat_status_idx
  on destination_locks (chat_configuration_id, status);

create index if not exists destination_locks_platform_status_ends_idx
  on destination_locks (platform_id, status, ends_at);

create index if not exists destination_locks_status_ends_idx
  on destination_locks (status, ends_at);

create unique index if not exists destination_locks_one_active_per_chat_idx
  on destination_locks (chat_configuration_id)
  where status = 'active';

create table if not exists destination_moderation_hits (
  id serial primary key,
  chat_configuration_id integer not null references chat_configurations(id) on delete cascade,
  platform_id integer not null references platforms(id) on delete cascade,
  platform_type text not null,
  destination_external_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp not null default now()
);

create index if not exists destination_moderation_hits_chat_created_idx
  on destination_moderation_hits (chat_configuration_id, created_at);

create index if not exists destination_moderation_hits_platform_created_idx
  on destination_moderation_hits (platform_id, created_at);
