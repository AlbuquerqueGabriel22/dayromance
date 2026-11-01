create table if not exists public.couple_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.guest_families (
  id text primary key,
  name text not null,
  phone text not null default '',
  rsvp_submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.guests (
  id text primary key,
  family_id text not null references public.guest_families(id) on delete cascade,
  name text not null,
  is_child boolean not null default false,
  age integer not null default 0 check (age >= 0),
  confirmed boolean,
  created_at timestamptz not null default now()
);

create table if not exists public.guest_rsvp_invites (
  id uuid primary key default gen_random_uuid(),
  family_id text not null references public.guest_families(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.guest_lookup_rate_limits (
  lookup_key text primary key,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0
);

create table if not exists public.guest_qr_tokens (
  token_hash text primary key,
  guest_id text not null unique references public.guests(id) on delete cascade,
  issued_at timestamptz not null default now()
);

create table if not exists public.guest_checkins (
  id uuid primary key default gen_random_uuid(),
  guest_id text not null unique references public.guests(id) on delete cascade,
  checked_in_at timestamptz not null default now()
);

create table if not exists public.gift_reservations (
  id uuid primary key,
  guest_name text not null check (char_length(guest_name) between 2 and 120),
  whatsapp text not null check (whatsapp ~ '^[0-9]{10,15}$'),
  gift_title text not null check (char_length(gift_title) between 1 and 160),
  quotas integer not null check (quotas between 1 and 100),
  event_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.gift_reminder_deliveries (
  reservation_id uuid not null references public.gift_reservations(id) on delete cascade,
  days_before smallint not null check (days_before in (30, 15)),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent')),
  attempt_count integer not null default 0,
  lease_expires_at timestamptz,
  sent_at timestamptz,
  last_error text,
  primary key (reservation_id, days_before)
);

create table if not exists public.gift_reminder_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false
);

insert into public.gift_reminder_settings (id, enabled)
values (true, false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guest-qr-pdfs', 'guest-qr-pdfs', false, 2097152, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = 2097152,
    allowed_mime_types = array['application/pdf'];

create index if not exists guests_family_id_idx on public.guests(family_id);
create index if not exists guest_rsvp_invites_family_id_idx on public.guest_rsvp_invites(family_id);

alter table public.couple_admins enable row level security;
alter table public.guest_families enable row level security;
alter table public.guests enable row level security;
alter table public.guest_rsvp_invites enable row level security;
alter table public.guest_lookup_rate_limits enable row level security;
alter table public.guest_qr_tokens enable row level security;
alter table public.guest_checkins enable row level security;
alter table public.gift_reservations enable row level security;
alter table public.gift_reminder_deliveries enable row level security;
alter table public.gift_reminder_settings enable row level security;

create policy "Admins can view own admin membership"
  on public.couple_admins for select to authenticated
  using (user_id = auth.uid());

create policy "Admins can manage guest families"
  on public.guest_families for all to authenticated
  using (exists (select 1 from public.couple_admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.couple_admins a where a.user_id = auth.uid()));

create policy "Admins can manage guests"
  on public.guests for all to authenticated
  using (exists (select 1 from public.couple_admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.couple_admins a where a.user_id = auth.uid()));

create policy "Admins can view check-ins"
  on public.guest_checkins for select to authenticated
  using (exists (select 1 from public.couple_admins a where a.user_id = auth.uid()));

create or replace function public.invalidate_guest_qr_on_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.confirmed is distinct from new.confirmed or old.name is distinct from new.name then
    delete from public.guest_qr_tokens where guest_id = old.id;
    delete from public.guest_checkins where guest_id = old.id;
    delete from storage.objects
    where bucket_id = 'guest-qr-pdfs' and name = old.id || '/convite.pdf';
  end if;
  return new;
end;
$$;

drop trigger if exists invalidate_guest_qr_on_status_change on public.guests;
create trigger invalidate_guest_qr_on_status_change
  before update of confirmed, name on public.guests
  for each row execute function public.invalidate_guest_qr_on_status_change();

create or replace function public.delete_guest_qr_file()
returns trigger
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
begin
  delete from storage.objects
  where bucket_id = 'guest-qr-pdfs' and name = old.id || '/convite.pdf';
  return old;
end;
$$;

drop trigger if exists delete_guest_qr_file on public.guests;
create trigger delete_guest_qr_file
  before delete on public.guests
  for each row execute function public.delete_guest_qr_file();

create or replace function public.consume_guest_rsvp(
  p_family_id text,
  p_invite_hash text,
  p_responses jsonb,
  p_qr_tokens jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  expected_count integer;
  response_count integer;
  confirmed_count integer;
  token_count integer;
  result jsonb;
begin
  perform 1
  from public.guest_rsvp_invites i
  where i.family_id = p_family_id
    and i.token_hash = p_invite_hash
    and i.used_at is null
    and i.expires_at > now()
  for update;

  if not found then
    raise exception 'invite_invalid';
  end if;

  perform 1
  from public.guest_families f
  where f.id = p_family_id
    and f.rsvp_submitted_at is null
  for update;

  if not found then
    raise exception 'rsvp_already_submitted';
  end if;

  select count(*) into expected_count
  from public.guests g where g.family_id = p_family_id;

  select count(*) into response_count
  from jsonb_each(p_responses);

  if expected_count = 0 or response_count <> expected_count
    or exists (
      select 1
      from jsonb_each(p_responses) r
      where jsonb_typeof(r.value) <> 'boolean'
        or not exists (
          select 1 from public.guests g
          where g.id = r.key and g.family_id = p_family_id
        )
    ) then
    raise exception 'invalid_responses';
  end if;

  select count(*) into confirmed_count
  from jsonb_each(p_responses) r
  where r.value = 'true'::jsonb;

  select count(*) into token_count
  from jsonb_each_text(p_qr_tokens);

  if token_count <> confirmed_count
    or exists (
      select 1 from jsonb_each(p_responses) r
      where r.value = 'true'::jsonb
        and not (p_qr_tokens ? r.key)
    )
    or exists (
      select 1 from jsonb_each(p_qr_tokens) t
      where not exists (
        select 1 from jsonb_each(p_responses) r
        where r.key = t.key and r.value = 'true'::jsonb
      )
    ) then
    raise exception 'invalid_qr_tokens';
  end if;

  update public.guests g
  set confirmed = (p_responses ->> g.id)::boolean
  where g.family_id = p_family_id;

  insert into public.guest_qr_tokens (guest_id, token_hash)
  select t.key, t.value
  from jsonb_each_text(p_qr_tokens) t;

  update public.guest_families
  set rsvp_submitted_at = now()
  where id = p_family_id;

  update public.guest_rsvp_invites
  set used_at = now()
  where family_id = p_family_id and token_hash = p_invite_hash;

  select jsonb_agg(jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'isChild', g.is_child,
    'age', g.age,
    'confirmed', g.confirmed
  ) order by g.name)
  into result
  from public.guests g
  where g.family_id = p_family_id and g.confirmed is true;

  return coalesce(result, '[]'::jsonb);
end;
$$;

create or replace function public.allow_guest_lookup_attempt(p_lookup_key text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_attempt_count integer;
begin
  delete from public.guest_lookup_rate_limits
  where window_started_at < now() - interval '1 day';

  insert into public.guest_lookup_rate_limits (lookup_key, window_started_at, attempt_count)
  values (p_lookup_key, now(), 1)
  on conflict (lookup_key) do update
  set window_started_at = case
        when guest_lookup_rate_limits.window_started_at < now() - interval '15 minutes' then now()
        else guest_lookup_rate_limits.window_started_at
      end,
      attempt_count = case
        when guest_lookup_rate_limits.window_started_at < now() - interval '15 minutes' then 1
        else guest_lookup_rate_limits.attempt_count + 1
      end
  returning attempt_count into current_attempt_count;

  return current_attempt_count <= 10;
end;
$$;

create or replace function public.create_gift_reservation(
  p_id uuid,
  p_guest_name text,
  p_whatsapp text,
  p_gift_title text,
  p_quotas integer,
  p_event_date date
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_event_date <= (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'gift_event_date_not_future';
  end if;

  if not exists (
    select 1 from public.gift_reminder_settings where id is true and enabled is true
  ) then
    raise exception 'gift_reminders_not_enabled';
  end if;

  insert into public.gift_reservations (id, guest_name, whatsapp, gift_title, quotas, event_date)
  values (
    p_id,
    trim(p_guest_name),
    p_whatsapp,
    trim(p_gift_title),
    p_quotas,
    p_event_date
  )
  on conflict (id) do nothing;

  if not exists (
    select 1
    from public.gift_reservations reservation
    where reservation.id = p_id
      and reservation.guest_name = trim(p_guest_name)
      and reservation.whatsapp = p_whatsapp
      and reservation.gift_title = trim(p_gift_title)
      and reservation.quotas = p_quotas
      and reservation.event_date = p_event_date
  ) then
    raise exception 'gift_reservation_id_conflict';
  end if;

  return p_id;
end;
$$;

create or replace function public.claim_due_gift_reminders()
returns table (
  reservation_id uuid,
  days_before smallint,
  guest_name text,
  whatsapp text,
  gift_title text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.gift_reminder_deliveries (reservation_id, days_before)
  select r.id, reminder.days_before
  from public.gift_reservations r
  cross join (values (30::smallint), (15::smallint)) as reminder(days_before)
  where current_date >= r.event_date - reminder.days_before
    and current_date < r.event_date
    and (r.created_at at time zone 'America/Sao_Paulo')::date
      <= r.event_date - reminder.days_before
  on conflict (reservation_id, days_before) do nothing;

  return query
  with candidates as (
    select delivery.reservation_id, delivery.days_before
    from public.gift_reminder_deliveries delivery
    join public.gift_reservations reservation on reservation.id = delivery.reservation_id
    where (
      delivery.status = 'pending'
      or (delivery.status = 'sending' and delivery.lease_expires_at < now())
    )
      and current_date < reservation.event_date
    order by delivery.reservation_id, delivery.days_before desc
    for update of delivery skip locked
  ),
  claimed as (
    update public.gift_reminder_deliveries delivery
    set status = 'sending',
        attempt_count = delivery.attempt_count + 1,
        lease_expires_at = now() + interval '10 minutes',
        last_error = null
    from candidates
    where delivery.reservation_id = candidates.reservation_id
      and delivery.days_before = candidates.days_before
    returning delivery.reservation_id, delivery.days_before
  )
  select reservation.id, claimed.days_before, reservation.guest_name,
         reservation.whatsapp, reservation.gift_title
  from claimed
  join public.gift_reservations reservation on reservation.id = claimed.reservation_id;
end;
$$;

create or replace function public.mark_gift_reminder_sent(
  p_reservation_id uuid,
  p_days_before smallint
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.gift_reminder_deliveries
  set status = 'sent', sent_at = now(), lease_expires_at = null, last_error = null
  where reservation_id = p_reservation_id and days_before = p_days_before;
$$;

create or replace function public.mark_gift_reminder_failed(
  p_reservation_id uuid,
  p_days_before smallint,
  p_error text
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.gift_reminder_deliveries
  set status = 'pending', lease_expires_at = null, last_error = left(p_error, 500)
  where reservation_id = p_reservation_id and days_before = p_days_before;
$$;

create or replace function public.validate_guest_checkin(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_guest public.guests%rowtype;
  checkin_time timestamptz;
begin
  select g.* into target_guest
  from public.guest_qr_tokens q
  join public.guests g on g.id = q.guest_id
  where q.token_hash = p_token_hash
    and g.confirmed is true
  for update of g;

  if not found then
    return jsonb_build_object('status', 'not_confirmed');
  end if;

  insert into public.guest_checkins (guest_id)
  values (target_guest.id)
  on conflict (guest_id) do nothing
  returning guest_checkins.checked_in_at into checkin_time;

  if checkin_time is null then
    select c.checked_in_at into checkin_time
    from public.guest_checkins c where c.guest_id = target_guest.id;
    return jsonb_build_object(
      'status', 'already_checked_in',
      'name', target_guest.name,
      'checkedInAt', checkin_time
    );
  end if;

  return jsonb_build_object(
    'status', 'checked_in',
    'name', target_guest.name,
    'checkedInAt', checkin_time
  );
end;
$$;

create or replace function public.reissue_guest_qr_tokens(
  p_family_id text,
  p_qr_tokens jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  confirmed_count integer;
  token_count integer;
  result jsonb;
begin
  perform 1
  from public.guest_families f
  where f.id = p_family_id
    and f.rsvp_submitted_at is not null
  for update;

  if not found then
    raise exception 'rsvp_not_submitted';
  end if;

  select count(*) into confirmed_count
  from public.guests g
  where g.family_id = p_family_id and g.confirmed is true;
  select count(*) into token_count from jsonb_each_text(p_qr_tokens);

  if token_count <> confirmed_count
    or exists (
      select 1
      from public.guests g
      where g.family_id = p_family_id
        and g.confirmed is true
        and not (p_qr_tokens ? g.id)
    )
    or exists (
      select 1
      from jsonb_each_text(p_qr_tokens) t
      where not exists (
        select 1 from public.guests g
        where g.id = t.key and g.family_id = p_family_id and g.confirmed is true
      )
    ) then
    raise exception 'invalid_qr_tokens';
  end if;

  insert into public.guest_qr_tokens (guest_id, token_hash)
  select t.key, t.value
  from jsonb_each_text(p_qr_tokens) t
  on conflict (guest_id) do update set token_hash = excluded.token_hash;

  select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name) order by g.name)
  into result
  from public.guests g
  where g.family_id = p_family_id and g.confirmed is true;

  return coalesce(result, '[]'::jsonb);
end;
$$;

revoke all on function public.consume_guest_rsvp(text, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.allow_guest_lookup_attempt(text) from public, anon, authenticated;
revoke all on function public.create_gift_reservation(uuid, text, text, text, integer, date) from public, anon, authenticated;
revoke all on function public.claim_due_gift_reminders() from public, anon, authenticated;
revoke all on function public.mark_gift_reminder_sent(uuid, smallint) from public, anon, authenticated;
revoke all on function public.mark_gift_reminder_failed(uuid, smallint, text) from public, anon, authenticated;
revoke all on function public.validate_guest_checkin(text) from public, anon, authenticated;
revoke all on function public.reissue_guest_qr_tokens(text, jsonb) from public, anon, authenticated;
grant execute on function public.consume_guest_rsvp(text, text, jsonb, jsonb) to service_role;
grant execute on function public.allow_guest_lookup_attempt(text) to service_role;
grant execute on function public.create_gift_reservation(uuid, text, text, text, integer, date) to service_role;
grant execute on function public.claim_due_gift_reminders() to service_role;
grant execute on function public.mark_gift_reminder_sent(uuid, smallint) to service_role;
grant execute on function public.mark_gift_reminder_failed(uuid, smallint, text) to service_role;
grant execute on function public.validate_guest_checkin(text) to service_role;
grant execute on function public.reissue_guest_qr_tokens(text, jsonb) to service_role;
