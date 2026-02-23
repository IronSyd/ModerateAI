-- Preserve existing 'groupMode=false' intent when migrating to per-group response control.
-- Idempotent: rows already inactive are not touched.
UPDATE chat_configurations AS cc
SET is_active = false,
    updated_at = NOW()
FROM platforms AS p
WHERE cc.platform_id = p.id
  AND p.type = 'telegram'
  AND cc.chat_type IN ('group', 'supergroup')
  AND cc.is_active = true
  AND COALESCE(cc.settings->>'groupMode', 'true') = 'false';
