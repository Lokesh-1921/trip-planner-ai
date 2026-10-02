-- Prepared for your own Supabase Free project. NOT applied: no project is connected yet.
-- Reference tables are public read-only (synthetic). Private tables are owner-only via anonymous auth.

create table public.destinations (
  destination_id text primary key, city text not null, meal_inr_per_person_day integer not null check (meal_inr_per_person_day >= 0),
  transfer_inr_per_group integer not null check (transfer_inr_per_group >= 0), valid_from text not null, valid_to text not null,
  is_synthetic boolean not null check (is_synthetic), dataset_version text not null, description text
);
create table public.origins (origin_id text primary key, city text not null, is_synthetic boolean not null check (is_synthetic));
create table public.flights (
  flight_id text primary key, origin_id text not null references public.origins, destination_id text not null references public.destinations,
  label text not null, roundtrip_inr_per_person integer not null check (roundtrip_inr_per_person >= 0), stops_each_way integer not null,
  duration_minutes_each_way integer not null, baggage_kg integer not null, cancellation_inr_per_person integer not null,
  taxes_included boolean not null, valid_from text not null, valid_to text not null, is_synthetic boolean not null check (is_synthetic), dataset_version text not null
);
create table public.hotels (
  hotel_id text primary key, destination_id text not null references public.destinations, label text not null,
  nightly_inr_per_room integer not null check (nightly_inr_per_room >= 0), max_guests_per_room integer not null, max_rooms integer not null,
  quiet boolean not null, step_free boolean not null, diet_tags text, refundable boolean not null, cancellation_terms text,
  taxes_included boolean not null, valid_from text not null, valid_to text not null, is_synthetic boolean not null check (is_synthetic), dataset_version text not null
);

grant select on public.destinations, public.origins, public.flights, public.hotels to anon, authenticated;
grant all on public.destinations, public.origins, public.flights, public.hotels to service_role;
alter table public.destinations enable row level security;
alter table public.origins enable row level security;
alter table public.flights enable row level security;
alter table public.hotels enable row level security;
create policy "public read synthetic" on public.destinations for select using (true);
create policy "public read synthetic" on public.origins for select using (true);
create policy "public read synthetic" on public.flights for select using (true);
create policy "public read synthetic" on public.hotels for select using (true);

-- Private, owner-only
create table public.trips (
  trip_id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  trip_version integer not null default 0, dataset_version text not null, confirmed_inputs jsonb not null default '{}'::jsonb,
  status text not null default 'draft', updated_at timestamptz not null default now(), expires_at timestamptz not null default now() + interval '7 days'
);
create table public.messages (
  message_id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade, trip_version integer not null,
  role text not null check (role in ('user','assistant','system')), redacted_content text not null, validated_output jsonb,
  idempotency_key text not null, created_at timestamptz not null default now(), unique (owner_id, idempotency_key)
);
create table public.retrieval_traces (
  trace_id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade, trip_version integer not null,
  dataset_version text not null, filters jsonb not null, result_count integer not null, record_ids jsonb not null,
  error_code text, model_id text, created_at timestamptz not null default now()
);
create table public.selections (
  selection_id uuid primary key default gen_random_uuid(), trip_id uuid not null references public.trips on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade, trip_version integer not null,
  option_id text not null, simulated boolean not null default true check (simulated), idempotency_key text not null,
  created_at timestamptz not null default now(), unique (owner_id, idempotency_key)
);
create table public.events (
  event_id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  trip_id uuid references public.trips on delete cascade,
  name text not null check (name in ('session_started','trip_confirmed','details_opened','selection_simulated','session_cleared','error_shown')),
  properties jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.trips, public.messages, public.retrieval_traces, public.selections, public.events to authenticated;
grant all on public.trips, public.messages, public.retrieval_traces, public.selections, public.events to service_role;

alter table public.trips enable row level security;
alter table public.messages enable row level security;
alter table public.retrieval_traces enable row level security;
alter table public.selections enable row level security;
alter table public.events enable row level security;

create policy "owner only" on public.trips for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner only" on public.messages for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner only" on public.retrieval_traces for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner only" on public.selections for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner only" on public.events for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Import the four CSVs from src/data/ (Table editor > Import CSV) preserving every ID and row:
-- destinations 20, origins 25, flights 960, hotels 60. Enable Anonymous sign-ins in Auth settings.
-- Schedule: delete from public.trips where expires_at < now();  (7-day retention)
