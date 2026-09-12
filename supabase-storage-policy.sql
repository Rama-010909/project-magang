-- Jalankan sekali di Supabase Dashboard -> SQL Editor.
-- Bucket harus bernama: asset-photos dan dibuat sebagai Public.

create policy "Allow public asset photo uploads"
on storage.objects
for insert
to anon
with check (bucket_id = 'asset-photos');
