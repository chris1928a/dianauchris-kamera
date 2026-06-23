-- ============================================================
--  Supabase Setup fuer die Hochzeits-Kamera
--  Ausfuehren im Supabase Dashboard > SQL Editor
-- ============================================================

-- 1) Bucket anlegen (oeffentlich lesbar, damit die Galerie die Bilder anzeigt).
--    Pfade sind zufaellig und nicht erratbar.
insert into storage.buckets (id, name, public)
values ('wedding-photos', 'wedding-photos', true)
on conflict (id) do update set public = true;

-- 2) Gaeste duerfen Fotos hochladen (nur INSERT, kein Login noetig).
drop policy if exists "wedding anon upload" on storage.objects;
create policy "wedding anon upload"
  on storage.objects
  for insert
  to anon, authenticated
  with check ( bucket_id = 'wedding-photos' );

-- 3) Lesen/Listen, damit die Host-Galerie (gallery.html) funktioniert.
--    Nach der Hochzeit kannst du diese Policy entfernen, wenn du die
--    Bilder nur noch ueber das Dashboard verwalten willst.
drop policy if exists "wedding read list" on storage.objects;
create policy "wedding read list"
  on storage.objects
  for select
  to anon, authenticated
  using ( bucket_id = 'wedding-photos' );

-- ------------------------------------------------------------
--  Hinweis: Gaeste koennen Fotos NICHT loeschen oder ueberschreiben,
--  da keine UPDATE/DELETE-Policy existiert. Das ist Absicht.
-- ------------------------------------------------------------
