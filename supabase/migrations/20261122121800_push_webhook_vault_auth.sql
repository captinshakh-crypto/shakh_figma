-- Centralize webhook authentication in Supabase Vault; no duplicate Edge secret is needed.
create or replace function public.verify_push_webhook_secret(p_candidate text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, vault, extensions
as $function$
declare
  v_secret text;
  v_candidate text := btrim(coalesce(p_candidate, ''), E' \t\n\r');
begin
  select btrim(decrypted_secret, E' \t\n\r') into v_secret
  from vault.decrypted_secrets
  where name = 'push_webhook_secret'
  limit 1;

  if coalesce(v_secret, '') = '' or v_candidate = '' then
    return false;
  end if;

  return extensions.digest(convert_to(v_secret, 'UTF8'), 'sha256')
       = extensions.digest(convert_to(v_candidate, 'UTF8'), 'sha256');
end;
$function$;

revoke all on function public.verify_push_webhook_secret(text) from public, anon, authenticated;
grant execute on function public.verify_push_webhook_secret(text) to service_role;

create or replace function private.notify_push_on_notification()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, vault, net
as $function$
declare
  v_webhook_secret text;
  v_project_url text;
begin
  select btrim(decrypted_secret, E' \t\n\r') into v_webhook_secret
  from vault.decrypted_secrets
  where name = 'push_webhook_secret'
  limit 1;

  select decrypted_secret into v_project_url
  from vault.decrypted_secrets
  where name = 'supabase_project_url'
  limit 1;

  if coalesce(v_webhook_secret, '') = '' or coalesce(v_project_url, '') = '' then
    raise warning 'Web push trigger skipped: required Vault secret is missing';
    return new;
  end if;

  perform net.http_post(
    v_project_url || '/functions/v1/send-web-push',
    jsonb_build_object('notification_id', new.id),
    '{}'::jsonb,
    jsonb_build_object(
      'Content-Type', 'application/json',
      'x-shakh-push-auth', v_webhook_secret
    ),
    5000
  );

  return new;
exception when others then
  raise warning 'Web push enqueue failed: %', sqlerrm;
  return new;
end;
$function$;

drop function if exists public.inspect_push_webhook_secret(text);