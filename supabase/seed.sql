-- Seed de prueba (sección 13, fase 3): un dueño con login por email y su tienda.
-- Credenciales: dueno@prueba.local / password123

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new,
  email_change, raw_app_meta_data, raw_user_meta_data
)
values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated',
  'authenticated',
  'dueno@prueba.local',
  crypt('password123', gen_salt('bf')),
  now(), now(), now(), '', '', '', '',
  '{"provider":"email","providers":["email"]}',
  '{}'
)
on conflict (id) do nothing;

insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
values (
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  format('{"sub":"%s","email":"dueno@prueba.local","email_verified":true,"phone_verified":false}', '11111111-1111-1111-1111-111111111111')::jsonb,
  'email',
  now(), now(), now()
)
on conflict (provider_id, provider) do nothing;

insert into stores (id, owner_user_id, name)
values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Tienda de prueba')
on conflict (id) do nothing;