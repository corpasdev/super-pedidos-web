-- Configuración de la tienda: nombre, administrador, correo de contacto y logo.
-- El logo vive en Supabase Storage (bucket store-logos); en la tabla solo se guarda su ruta.

-- ---------------------------------------------------------------------------
-- Perfil de la tienda
-- ---------------------------------------------------------------------------
alter table stores
  add column admin_name text check (char_length(admin_name) <= 120),
  add column contact_email text check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add column logo_path text,
  add column updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- Storage: logos de las tiendas
-- Público para lectura (el logo se muestra en la app); solo imágenes rasterizadas de hasta 2 MB.
-- La API sube con la llave secreta y guarda en la carpeta {store_id}/.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-logos', 'store-logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- El dueño firmado solo puede escribir en la carpeta de su propia tienda (por si la web sube directo en el futuro).
create policy "owner writes own store logo" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'store-logos'
    and (storage.foldername(name))[1] in (select id::text from stores where owner_user_id = (select auth.uid()))
  )
  with check (
    bucket_id = 'store-logos'
    and (storage.foldername(name))[1] in (select id::text from stores where owner_user_id = (select auth.uid()))
  );
