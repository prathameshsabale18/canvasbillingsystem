-- Normalize existing invoice dates and require DD/MM/YYYY for future rows.
alter table public.invoices
  alter column "date" drop default;

do $$
declare
  invoice_date_type text;
begin
  select data_type
    into invoice_date_type
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'invoices'
     and column_name = 'date';

  if invoice_date_type is null then
    raise exception 'public.invoices.date was not found';
  elsif invoice_date_type = 'date' then
    execute $sql$
      alter table public.invoices
      alter column "date" type text
      using to_char("date", 'DD/MM/YYYY')
    $sql$;
  elsif invoice_date_type like 'timestamp%' then
    execute $sql$
      alter table public.invoices
      alter column "date" type text
      using to_char("date", 'DD/MM/YYYY')
    $sql$;
  elsif invoice_date_type in ('text', 'character varying', 'character') then
    if exists (
      select 1
        from public.invoices
       where "date" is not null
         and "date" !~ '^([0-9]{4}-[0-9]{2}-[0-9]{2}([T ].*)?|[0-9]{2}/[0-9]{2}/[0-9]{4}|[0-9]{2}-[0-9]{2}-[0-9]{4})$'
    ) then
      raise exception 'Found invoice dates in an unsupported format; correct those rows before rerunning this migration';
    end if;

    update public.invoices
       set "date" = case
         when "date" ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' then "date"
         when "date" ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}$' then
           substring("date" from 1 for 2) || '/' ||
           substring("date" from 4 for 2) || '/' ||
           substring("date" from 7 for 4)
         else
           substring("date" from 9 for 2) || '/' ||
           substring("date" from 6 for 2) || '/' ||
           substring("date" from 1 for 4)
       end
     where "date" is not null;

    execute $sql$
      alter table public.invoices
      alter column "date" type text
      using "date"::text
    $sql$;
  else
    raise exception 'Unsupported public.invoices.date type: %', invoice_date_type;
  end if;
end
$$;

alter table public.invoices
  alter column "date" set default to_char(current_date, 'DD/MM/YYYY');

alter table public.invoices
  drop constraint if exists invoices_date_ddmmyyyy_check;

alter table public.invoices
  add constraint invoices_date_ddmmyyyy_check
  check (
    "date" is null
    or (
      "date" ~ '^(0[1-9]|[12][0-9]|3[01])/(0[1-9]|1[0-2])/[0-9]{4}$'
      and to_char(to_date("date", 'DD/MM/YYYY'), 'DD/MM/YYYY') = "date"
    )
  );

notify pgrst, 'reload schema';