-- Run this in the Supabase SQL editor before using invoice PDF downloads.
alter table public.invoices
  alter column invoice_no type text
  using invoice_no::text;

alter table public.invoices
  add column if not exists pdf_storage_path text;

alter table public.invoice_items
  add column if not exists hsn text;

alter table public.invoice_items
  add column if not exists per text;

alter table public.invoice_items
  add column if not exists rate numeric;

notify pgrst, 'reload schema';

insert into public.profiles (id, email, role)
select id, email, 'admin'
from auth.users
where lower(email) in ('canvascreationindia@gmail.com', 'prathameshsabale1815@gmail.com')
on conflict (id) do update
set email = excluded.email,
    role = 'admin';

insert into storage.buckets (id, name, public)
values ('invoice-pdfs', 'invoice-pdfs', false)
on conflict (id) do update set public = false;

drop policy if exists "Authenticated users can read invoice PDFs" on storage.objects;
drop policy if exists "App users can read invoice PDFs" on storage.objects;
create policy "App users can read invoice PDFs"
on storage.objects for select
to authenticated
using (bucket_id = 'invoice-pdfs');

drop policy if exists "App users can upload invoice PDFs" on storage.objects;
drop policy if exists "Authenticated users can upload invoice PDFs" on storage.objects;
create policy "App users can upload invoice PDFs"
on storage.objects for insert
to authenticated
with check (bucket_id = 'invoice-pdfs');

drop policy if exists "App users can update invoice PDFs" on storage.objects;
drop policy if exists "Authenticated users can update invoice PDFs" on storage.objects;
create policy "App users can update invoice PDFs"
on storage.objects for update
to authenticated
using (bucket_id = 'invoice-pdfs')
with check (bucket_id = 'invoice-pdfs');

drop policy if exists "App users can delete invoice PDFs" on storage.objects;
drop policy if exists "Authenticated users can delete invoice PDFs" on storage.objects;
create policy "App users can delete invoice PDFs"
on storage.objects for delete
to authenticated
using (bucket_id = 'invoice-pdfs');
