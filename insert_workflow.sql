INSERT INTO workflows (id, tenant_id, owner_user_id, name, definition, created_at)
VALUES (
'00000000-0000-0000-0000-000000000001',
'demo-tenant',
'system',
'sample',
'{"nodes":[{"id":"n1","type":"transform","config":{"result":{"msg":"hello"}}}],"edges":[]} '::json,
now()
)
ON CONFLICT (id) DO NOTHING;