-- Import products missing from the current products table.
-- Safe to rerun: existing product names are skipped case-insensitively.
begin;

with incoming (product, category, spec, rates, hsn) as (
  values
    ('Casual In-out Register', 'Books/Logbooks', 'Nos', 'Nos @ 375', ''),
    ('Challenge test - auto viscosity controller. FM.PRD.41/00', 'Books/Checklists', 'Nos', 'Nos @ 150', ''),
    ('Challenge test for auto tag detector at slitting machine FM.PRD.40/00', 'Books/Checklists', 'Nos', 'Nos @ 150', ''),
    ('Challenge test for avt on 6 col printing machine FM.PRD.43/00', 'Books/Checklists', 'Nos', 'Nos @ 150', ''),
    ('Challenge test for poly mixing sensor heat and press machine FM.PRD.44/00', 'Books/Checklists', 'Nos', 'Nos @ 150', ''),
    ('Challenge test for tag inserter adh machine FM.PRD.39/00', 'Books/Checklists', 'Nos', 'Nos @ 150', ''),
    ('Checklist For Material Unloading Book FM.SCM.11/3', 'Books/Checklists', 'Nos', 'Nos @ 150', ''),
    ('Contract Employee Gate Pass', 'Printing/Stationery', 'Nos', 'Nos @ 100', ''),
    ('Daily Weight verification checklist FM.SCM.19/02', 'Books/Checklists', 'Nos', 'Nos @ 150', ''),
    ('Godown Inward Register FM.SCM.08A/00', 'Books/Logbooks', 'Nos', 'Nos @ 300', ''),
    ('Godown Outward Register FM.SCM.08B/00', 'Books/Logbooks', 'Nos', 'Nos @ 300', ''),
    ('HAZARDOUS WASTE GENERATION SLIP FM.EHS.37/00', 'Printing/Stationery', 'Nos', 'Nos @ 150', ''),
    ('HSL Batch Record FM.PRD.32/01', 'Books/Logbooks', 'Nos', 'Nos @ 150', ''),
    ('Line Clearence process Extrusion/H&P/ADH Book FM.PRD.24/01', 'Books/Logbooks', 'Nos', 'Nos @ 375', ''),
    ('Line Clearence process Printing Book FM.PRD.07/01', 'Books/Logbooks', 'Nos', 'Nos @ 375', ''),
    ('Lockout/Tagout BOOK-A', 'Books/Logbooks', 'Nos', 'Nos @ 1300', ''),
    ('Lockout/Tagout BOOK-B', 'Books/Logbooks', 'Nos', 'Nos @ 1300', ''),
    ('Material Gate Passbook FM.SCM.16', 'Books/Logbooks', 'Nos', 'Nos @ 150', ''),
    ('Material Inward Register FM.SCM.08A/00', 'Books/Logbooks', 'Nos', 'Nos @ 300', ''),
    ('Material Outward Register FM.SCM.08B/00', 'Books/Logbooks', 'Nos', 'Nos @ 300', ''),
    ('Material Requisition Book FM.SCM.05/01', 'Books/Logbooks', 'Nos', 'Nos @ 150', ''),
    ('Material godown Register', 'Books/Logbooks', 'Nos', 'Nos @ 300', ''),
    ('Pouching Log Sheet FM.PRD.18/01', 'Books/Logbooks', 'Nos', 'Nos @ 375', ''),
    ('Safety Checklist Book - Slitting FM.PRD.01/00', 'Books/Checklists', 'Nos', 'Nos @ 375', ''),
    ('Safety Toolbox TALK', 'Books/Checklists', 'Nos', 'Nos @ 150', ''),
    ('Security Slip DISPATCH', 'Printing/Stationery', 'Nos', 'Nos @ 150', ''),
    ('Slitting Log Sheet Book FM.PRD.14/01', 'Books/Logbooks', 'Nos', 'Nos @ 375', ''),
    ('Thermic Fluid Heater Data FM.MNT.20', 'Books/Logbooks', 'Nos', 'Nos @ 375', ''),
    ('Utility Checklist BOOK', 'Books/Checklists', 'Nos', 'Nos @ 375', ''),
    ('Visitor Entry Book', 'Books/Logbooks', 'Nos', 'Nos @ 150', ''),
    ('VISITOR PASS FM.HRA.11/00', 'Printing/Stationery', 'Nos', 'Nos @ 150', ''),
    ('Work Permit Book Civil Work FM.PRD.36/02', 'Books/Checklists', 'Nos', 'Nos @ 280', ''),
    ('Work Permit Book HotWork FM.PRD.36/02', 'Books/Checklists', 'Nos', 'Nos @ 280', ''),
    ('Delivery Challan Inward Register', 'Books/Logbooks', 'Nos', 'Nos @ 375', ''),
    ('Returnable Inward Register', 'Books/Logbooks', 'Nos', 'Nos @ 375', ''),
    ('Laboratory Instrument / Equipment FM.QA.43/00', 'Books/Logbooks', 'Nos', 'Nos @ 375', '')
)
insert into public.products (product, category, spec, rates, hsn)
select incoming.product, incoming.category, incoming.spec, incoming.rates, incoming.hsn
from incoming
where not exists (
  select 1
  from public.products existing
  where lower(trim(existing.product)) = lower(trim(incoming.product))
);

commit;
