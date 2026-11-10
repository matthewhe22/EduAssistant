-- DeepSeek models aren't allowed in Australian schools: clear saved choices so teachers get the default (GLM 5.3 Flash).
update user_settings set default_model = null, updated_at = now() where default_model ilike '%deepseek%';
