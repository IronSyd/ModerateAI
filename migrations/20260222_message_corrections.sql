create table if not exists message_corrections (
  id serial primary key,
  message_id integer not null unique references messages(id) on delete cascade,
  conversation_id integer not null references conversations(id) on delete cascade,
  platform_id integer not null references platforms(id) on delete cascade,
  workspace_owner_id integer not null references users(id) on delete cascade,
  corrected_content text not null,
  annotation text,
  status text not null default 'draft',
  approved_for_learning_at timestamp,
  approved_by_user_id integer references users(id) on delete set null,
  training_insight_id integer references training_insights(id) on delete set null,
  chat_configuration_id integer references chat_configurations(id) on delete set null,
  source_metadata jsonb,
  created_by_user_id integer not null references users(id),
  updated_by_user_id integer not null references users(id),
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create index if not exists message_corrections_workspace_created_idx
  on message_corrections (workspace_owner_id, created_at desc);

create index if not exists message_corrections_conversation_idx
  on message_corrections (conversation_id);

create index if not exists message_corrections_status_approved_idx
  on message_corrections (status, approved_for_learning_at desc);
