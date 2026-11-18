-- Percentage-based merchant commission configuration is retired; use fixed IQD per sold unit.
drop function if exists public.set_commission_setting(public.app_role,integer,bigint);
