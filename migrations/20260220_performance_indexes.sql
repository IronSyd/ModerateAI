-- Performance indexes (zero-downtime safe)
-- IMPORTANT: run outside a transaction block because of CONCURRENTLY.

create index concurrently if not exists idx_platforms_user_id on platforms (user_id);
create index concurrently if not exists idx_platforms_user_id_type on platforms (user_id, type);

create index concurrently if not exists idx_conversations_platform_updated_desc on conversations (platform_id, updated_at desc);
create index concurrently if not exists idx_conversations_platform_created_desc on conversations (platform_id, created_at desc);

create index concurrently if not exists idx_messages_conversation_created_desc on messages (conversation_id, created_at desc);
create index concurrently if not exists idx_messages_sender_created_desc on messages (sender, created_at desc);

create index concurrently if not exists idx_chat_configurations_platform_type_active on chat_configurations (platform_id, chat_type, is_active);
create index concurrently if not exists idx_chat_configurations_platform_external on chat_configurations (platform_id, external_id);

create index concurrently if not exists idx_website_leads_user_created_desc on website_leads (user_id, created_at desc);
create index concurrently if not exists idx_website_leads_user_status_created_desc on website_leads (user_id, status, created_at desc);

create index concurrently if not exists idx_team_invitations_token on team_invitations (token);
