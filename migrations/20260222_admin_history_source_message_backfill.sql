ALTER TABLE chat_history
ADD COLUMN IF NOT EXISTS source_message_id integer REFERENCES messages(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS chat_history_source_message_id_unique_idx
ON chat_history (source_message_id)
WHERE source_message_id IS NOT NULL;

