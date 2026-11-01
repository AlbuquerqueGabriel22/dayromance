create table if not exists public.weddings (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.wedding_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wedding_id uuid not null unique references public.weddings(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.wedding_state (
  wedding_id uuid primary key references public.weddings(id) on delete cascade,
  couple_data jsonb not null,
  gifts jsonb not null default '[]'::jsonb,
  guest_messages jsonb not null default '[]'::jsonb,
  tasks jsonb not null default '[]'::jsonb,
  financials jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.guest_families
  add column if not exists wedding_id uuid references public.weddings(id) on delete cascade;

create index if not exists guest_families_wedding_id_idx
  on public.guest_families(wedding_id);

create table if not exists public.family_invite_links (
  id uuid primary key default gen_random_uuid(),
  family_id text not null references public.guest_families(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists family_invite_links_family_id_idx
  on public.family_invite_links(family_id);
alter table public.gift_reservations
  add column if not exists wedding_id uuid references public.weddings(id) on delete cascade;
alter table public.gift_reservations
  add column if not exists gift_id text;

grant select on public.weddings, public.wedding_members, public.wedding_state,
  public.gift_reservations to authenticated;
grant update on public.weddings to authenticated;
grant insert, update, delete on public.wedding_state to authenticated;
grant insert, select, update, delete on public.guest_families, public.guests to authenticated;
grant all on public.weddings, public.wedding_members, public.wedding_state,
  public.family_invite_links, public.guest_families, public.guests,
  public.guest_qr_tokens, public.guest_checkins, public.guest_rsvp_invites,
  public.gift_reservations to service_role;

alter table public.weddings enable row level security;
alter table public.wedding_members enable row level security;
alter table public.wedding_state enable row level security;
alter table public.family_invite_links enable row level security;

drop policy if exists "Admins can manage guest families" on public.guest_families;
drop policy if exists "Admins can manage guests" on public.guests;
drop policy if exists "Admins can view check-ins" on public.guest_checkins;

create policy "Users can view their wedding membership"
  on public.wedding_members for select to authenticated
  using (user_id = auth.uid());

create policy "Couples can view their wedding"
  on public.weddings for select to authenticated
  using (exists (
    select 1 from public.wedding_members member
    where member.wedding_id = weddings.id and member.user_id = auth.uid()
  ));

create policy "Couples can update their wedding"
  on public.weddings for update to authenticated
  using (exists (
    select 1 from public.wedding_members member
    where member.wedding_id = weddings.id and member.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.wedding_members member
    where member.wedding_id = weddings.id and member.user_id = auth.uid()
  ));

create policy "Couples can manage their wedding state"
  on public.wedding_state for all to authenticated
  using (exists (
    select 1 from public.wedding_members member
    where member.wedding_id = wedding_state.wedding_id and member.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.wedding_members member
    where member.wedding_id = wedding_state.wedding_id and member.user_id = auth.uid()
  ));

create policy "Couples can manage their guest families"
  on public.guest_families for all to authenticated
  using (wedding_id is not null and exists (
    select 1 from public.wedding_members member
    where member.wedding_id = guest_families.wedding_id and member.user_id = auth.uid()
  ))
  with check (wedding_id is not null and exists (
    select 1 from public.wedding_members member
    where member.wedding_id = guest_families.wedding_id and member.user_id = auth.uid()
  ));

create policy "Couples can manage guests in their wedding"
  on public.guests for all to authenticated
  using (exists (
    select 1
    from public.guest_families family
    join public.wedding_members member on member.wedding_id = family.wedding_id
    where family.id = guests.family_id and member.user_id = auth.uid()
  ))
  with check (exists (
    select 1
    from public.guest_families family
    join public.wedding_members member on member.wedding_id = family.wedding_id
    where family.id = guests.family_id and member.user_id = auth.uid()
  ));

create policy "Couples can view their guest check-ins"
  on public.guest_checkins for select to authenticated
  using (exists (
    select 1
    from public.guests guest
    join public.guest_families family on family.id = guest.family_id
    join public.wedding_members member on member.wedding_id = family.wedding_id
    where guest.id = guest_checkins.guest_id and member.user_id = auth.uid()
  ));

create policy "Couples can view their gift reservations"
  on public.gift_reservations for select to authenticated
  using (exists (
    select 1 from public.wedding_members member
    where member.wedding_id = gift_reservations.wedding_id and member.user_id = auth.uid()
  ));

create or replace function public.append_guest_message(
  p_wedding_id uuid,
  p_message jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if jsonb_typeof(p_message) <> 'object'
    or char_length(coalesce(p_message ->> 'name', '')) not between 1 and 80
    or char_length(coalesce(p_message ->> 'text', '')) not between 1 and 1000 then
    raise exception 'invalid_guest_message';
  end if;

  update public.wedding_state
  set guest_messages = guest_messages || jsonb_build_array(p_message),
      updated_at = now()
  where wedding_id = p_wedding_id;

  if not found then
    raise exception 'wedding_not_found';
  end if;
end;
$$;

create or replace function public.save_wedding_state_for_current_user(
  p_wedding_id uuid,
  p_couple_data jsonb,
  p_gifts jsonb,
  p_tasks jsonb,
  p_financials jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_gifts jsonb;
  merged_gifts jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.wedding_members member
    where member.user_id = auth.uid() and member.wedding_id = p_wedding_id
  ) then
    raise exception 'wedding_access_denied';
  end if;
  if jsonb_typeof(p_couple_data) is distinct from 'object'
    or jsonb_typeof(p_gifts) is distinct from 'array'
    or jsonb_typeof(p_tasks) is distinct from 'array'
    or jsonb_typeof(p_financials) is distinct from 'object' then
    raise exception 'invalid_wedding_state';
  end if;

  select gifts into current_gifts
  from public.wedding_state
  where wedding_id = p_wedding_id
  for update;
  if not found then
    raise exception 'wedding_not_found';
  end if;

  select coalesce(jsonb_agg(
    case
      when previous_gift.value is null then submitted_gift.value
      else jsonb_set(
        jsonb_set(
          submitted_gift.value,
          '{reservedQuotas}',
          coalesce(previous_gift.value -> 'reservedQuotas', '0'::jsonb),
          true
        ),
        '{reservations}',
        coalesce(previous_gift.value -> 'reservations', '[]'::jsonb),
        true
      )
    end
    order by submitted_gift.ordinality
  ), '[]'::jsonb)
  into merged_gifts
  from jsonb_array_elements(p_gifts) with ordinality as submitted_gift(value, ordinality)
  left join lateral (
    select current_gift.value
    from jsonb_array_elements(current_gifts) as current_gift(value)
    where current_gift.value ->> 'id' = submitted_gift.value ->> 'id'
    limit 1
  ) as previous_gift on true;

  update public.wedding_state
  set couple_data = p_couple_data,
      gifts = merged_gifts,
      tasks = p_tasks,
      financials = p_financials,
      updated_at = now()
  where wedding_id = p_wedding_id;
end;
$$;

create or replace function public.create_wedding_for_current_user(
  p_name text,
  p_state jsonb
)
returns table (wedding_id uuid, wedding_name text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_wedding_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;
  if p_name is null
    or char_length(trim(p_name)) not between 2 and 120
    or jsonb_typeof(p_state) is distinct from 'object' then
    raise exception 'invalid_wedding_data';
  end if;
  if exists (select 1 from public.wedding_members where user_id = auth.uid()) then
    raise exception 'wedding_already_exists';
  end if;

  insert into public.weddings (name, owner_user_id)
  values (trim(p_name), auth.uid())
  returning id into new_wedding_id;

  insert into public.wedding_members (user_id, wedding_id)
  values (auth.uid(), new_wedding_id);

  insert into public.wedding_state (
    wedding_id, couple_data, gifts, guest_messages, tasks, financials
  )
  values (
    new_wedding_id,
    coalesce(p_state -> 'coupleData', '{}'::jsonb),
    coalesce(p_state -> 'gifts', '[]'::jsonb),
    coalesce(p_state -> 'guestMessages', '[]'::jsonb),
    coalesce(p_state -> 'tasks', '[]'::jsonb),
    coalesce(p_state -> 'financials', '{}'::jsonb)
  );

  return query select new_wedding_id, trim(p_name);
end;
$$;

create or replace function public.create_gift_reservation(
  p_id uuid,
  p_gift_id text,
  p_guest_name text,
  p_whatsapp text,
  p_gift_title text,
  p_quotas integer,
  p_event_date date,
  p_wedding_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_gifts jsonb;
  selected_gift jsonb;
  selected_index integer;
  total_quotas integer;
  reserved_quotas integer;
  gifted_quotas integer;
  gift_reservations jsonb;
  updated_gift jsonb;
  updated_gifts jsonb;
begin
  if exists (select 1 from public.gift_reservations where id = p_id) then
    if not exists (
      select 1
      from public.gift_reservations reservation
      where reservation.id = p_id
        and reservation.wedding_id = p_wedding_id
        and reservation.gift_id = p_gift_id
        and reservation.guest_name = trim(p_guest_name)
        and reservation.whatsapp = p_whatsapp
        and reservation.gift_title = trim(p_gift_title)
        and reservation.quotas = p_quotas
        and reservation.event_date = p_event_date
    ) then
      raise exception 'gift_reservation_id_conflict';
    end if;
    return p_id;
  end if;

  if p_event_date <= (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'gift_event_date_not_future';
  end if;

  if not exists (
    select 1 from public.gift_reminder_settings where id is true and enabled is true
  ) then
    raise exception 'gift_reminders_not_enabled';
  end if;

  select gifts into current_gifts
  from public.wedding_state
  where wedding_id = p_wedding_id
  for update;

  if current_gifts is null then
    raise exception 'wedding_not_found';
  end if;

  select item.value, item.ordinality::integer
  into selected_gift, selected_index
  from jsonb_array_elements(current_gifts) with ordinality as item(value, ordinality)
  where item.value ->> 'id' = p_gift_id;

  if selected_gift is null then
    raise exception 'gift_not_found';
  end if;

  total_quotas := greatest(coalesce((selected_gift ->> 'totalQuotas')::integer, 1), 1);
  reserved_quotas := coalesce((selected_gift ->> 'reservedQuotas')::integer, 0);
  gifted_quotas := coalesce((selected_gift ->> 'giftedQuotas')::integer, 0);
  if p_quotas > total_quotas - reserved_quotas - gifted_quotas then
    raise exception 'gift_no_quotas_available';
  end if;

  gift_reservations := coalesce(selected_gift -> 'reservations', '[]'::jsonb);
  updated_gift := jsonb_set(
    jsonb_set(
      jsonb_set(selected_gift, '{reservedQuotas}', to_jsonb(reserved_quotas + p_quotas), true),
      '{reservations}',
      gift_reservations || jsonb_build_array(jsonb_build_object(
        'id', p_id,
        'name', trim(p_guest_name),
        'whatsapp', p_whatsapp,
        'quotas', p_quotas,
        'status', 'reserved'
      )),
      true
    ),
    '{giftedQuotas}',
    to_jsonb(gifted_quotas),
    true
  );
  updated_gifts := jsonb_set(current_gifts, array[(selected_index - 1)::text], updated_gift, false);

  insert into public.gift_reservations (
    id, wedding_id, gift_id, guest_name, whatsapp, gift_title, quotas, event_date
  )
  values (
    p_id, p_wedding_id, p_gift_id, trim(p_guest_name), p_whatsapp, trim(p_gift_title), p_quotas, p_event_date
  );

  if not exists (
    select 1
    from public.gift_reservations reservation
    where reservation.id = p_id
      and reservation.wedding_id = p_wedding_id
      and reservation.gift_id = p_gift_id
      and reservation.guest_name = trim(p_guest_name)
      and reservation.whatsapp = p_whatsapp
      and reservation.gift_title = trim(p_gift_title)
      and reservation.quotas = p_quotas
      and reservation.event_date = p_event_date
  ) then
    raise exception 'gift_reservation_id_conflict';
  end if;

  update public.wedding_state
  set gifts = updated_gifts,
      updated_at = now()
  where wedding_id = p_wedding_id;

  return p_id;
end;
$$;

create or replace function public.validate_guest_checkin(
  p_token_hash text,
  p_wedding_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_guest public.guests%rowtype;
  checkin_time timestamptz;
begin
  select guest.* into target_guest
  from public.guest_qr_tokens token
  join public.guests guest on guest.id = token.guest_id
  join public.guest_families family on family.id = guest.family_id
  where token.token_hash = p_token_hash
    and family.wedding_id = p_wedding_id
    and guest.confirmed is true
  for update of guest;

  if not found then
    return jsonb_build_object('status', 'not_confirmed');
  end if;

  insert into public.guest_checkins (guest_id)
  values (target_guest.id)
  on conflict (guest_id) do nothing
  returning guest_checkins.checked_in_at into checkin_time;

  if checkin_time is null then
    select checked_in_at into checkin_time
    from public.guest_checkins
    where guest_id = target_guest.id;
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

revoke all on function public.create_wedding_for_current_user(text, jsonb) from public, anon;
grant execute on function public.create_wedding_for_current_user(text, jsonb) to authenticated;
revoke all on function public.save_wedding_state_for_current_user(uuid, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_wedding_state_for_current_user(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;
revoke all on function public.validate_guest_checkin(text, uuid) from public, anon, authenticated;
grant execute on function public.validate_guest_checkin(text, uuid) to service_role;

revoke all on function public.append_guest_message(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.append_guest_message(uuid, jsonb) to service_role;

revoke all on function public.create_gift_reservation(uuid, text, text, text, integer, date) from public, anon, authenticated;
revoke all on function public.create_gift_reservation(uuid, text, text, text, integer, date, uuid) from public, anon, authenticated;
revoke all on function public.create_gift_reservation(uuid, text, text, text, text, integer, date, uuid) from public, anon, authenticated;
grant execute on function public.create_gift_reservation(uuid, text, text, text, text, integer, date, uuid) to service_role;
