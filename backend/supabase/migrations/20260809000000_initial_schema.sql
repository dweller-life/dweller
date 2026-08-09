-- Dweller initial schema
-- Tables per DWELLER_PROJECT_BRIEF.md "Data tables" section.
-- Run this in the Supabase SQL editor, or via `supabase db push`
-- once the project is linked with a Supabase CLI access token.

-- ============================================================
-- postcode_spine
-- Every UK postcode with its map location. Everything else references this.
-- ============================================================
create table if not exists postcode_spine (
  postcode text primary key,
  postcode_district text not null,        -- e.g. "SW1A" from "SW1A 1AA", used by postcode_to_water_company
  grid_ref text,                           -- OS grid square, used to join to the *_grid tables
  latitude double precision not null,
  longitude double precision not null,
  easting integer,
  northing integer,
  local_authority text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_postcode_spine_district on postcode_spine (postcode_district);
create index if not exists idx_postcode_spine_grid_ref on postcode_spine (grid_ref);

-- ============================================================
-- water_companies
-- ~20 rows of manually researched water company data.
-- ============================================================
create table if not exists water_companies (
  id uuid primary key default gen_random_uuid(),
  company_name text not null unique,
  hardness_mg_l numeric,
  nitrate_mg_l numeric,
  lead_ug_l numeric,
  thms_ug_l numeric,
  chlorine_mg_l numeric,
  ph numeric,
  compliance_pct numeric,
  pfas_notice boolean not null default false,
  pfas_notice_detail text,
  source_notes text,
  last_researched_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- postcode_to_water_company
-- Lookup: postcode prefix -> which water company.
-- ============================================================
create table if not exists postcode_to_water_company (
  postcode_prefix text primary key,
  water_company_id uuid not null references water_companies (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_postcode_to_water_company_company on postcode_to_water_company (water_company_id);

-- ============================================================
-- hardness_geology_estimate
-- Our own granular hardness model built from geology data,
-- cross-checked against water_companies.
-- ============================================================
create table if not exists hardness_geology_estimate (
  grid_ref text primary key,
  hardness_estimate_mg_l numeric not null,
  geology_source text,
  cross_check_water_company_id uuid references water_companies (id) on delete set null,
  cross_check_delta_mg_l numeric,          -- difference vs the referenced water company's figure
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- air_quality_grid
-- PM2.5 and NO2 by area, from the government's national grid file.
-- ============================================================
create table if not exists air_quality_grid (
  grid_ref text primary key,
  pm25_ug_m3 numeric,
  no2_ug_m3 numeric,
  data_year integer,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- radon_grid
-- Radon risk class (1-6) by area.
-- ============================================================
create table if not exists radon_grid (
  grid_ref text primary key,
  radon_class smallint not null check (radon_class between 1 and 6),
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- noise_grid
-- Night-time road and rail noise by area.
-- ============================================================
create table if not exists noise_grid (
  grid_ref text primary key,
  road_noise_db numeric,
  rail_noise_db numeric,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- light_pollution_grid
-- Light pollution estimate from satellite data.
-- ============================================================
create table if not exists light_pollution_grid (
  grid_ref text primary key,
  light_pollution_value numeric not null,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- green_space
-- Distance to nearest park/green space.
-- ============================================================
create table if not exists green_space (
  grid_ref text primary key,
  nearest_green_space_m numeric not null,
  nearest_green_space_name text,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- historic_landfill
-- Whether a postcode is near a former landfill.
-- Personal details from the source data stripped out entirely.
-- ============================================================
create table if not exists historic_landfill (
  grid_ref text primary key,
  within_250m boolean not null default false,
  nearest_landfill_distance_m numeric,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- epc_cache
-- Wall type, insulation, glazing, heating, build year, SAP score,
-- per property, from the EPC register.
-- ============================================================
create table if not exists epc_cache (
  uprn text primary key,                   -- Unique Property Reference Number
  postcode text references postcode_spine (postcode) on delete set null,
  wall_type text,
  wall_insulation text,
  glazing_type text,
  heating_type text,
  heating_fuel text,
  ventilation_type text,
  built_year integer,
  sap_score numeric,
  epc_band text,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_epc_cache_postcode on epc_cache (postcode);

-- ============================================================
-- postcode_cache
-- Saved copy of a finished report, so repeat lookups don't redo the work.
-- ============================================================
create table if not exists postcode_cache (
  postcode text primary key references postcode_spine (postcode) on delete cascade,
  report jsonb not null,
  generated_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- leads
-- Email, postcode, saved report, consent flags.
-- ============================================================
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  postcode text references postcode_spine (postcode) on delete set null,
  report jsonb,
  marketing_consent boolean not null default false,
  health_consent boolean not null default false,      -- separate opt-in for pregnancy/health condition fields, per brief
  consented_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_leads_email on leads (email);
create index if not exists idx_leads_postcode on leads (postcode);

-- ============================================================
-- Row Level Security
-- Reference/lookup tables: public read-only (frontend uses the publishable key).
-- Cache and lead tables: no public access; only the service role
-- (backend, using the secret key kept server-side) can read/write.
-- ============================================================

alter table postcode_spine enable row level security;
alter table water_companies enable row level security;
alter table postcode_to_water_company enable row level security;
alter table hardness_geology_estimate enable row level security;
alter table air_quality_grid enable row level security;
alter table radon_grid enable row level security;
alter table noise_grid enable row level security;
alter table light_pollution_grid enable row level security;
alter table green_space enable row level security;
alter table historic_landfill enable row level security;
alter table epc_cache enable row level security;
alter table postcode_cache enable row level security;
alter table leads enable row level security;

create policy "public read" on postcode_spine for select using (true);
create policy "public read" on water_companies for select using (true);
create policy "public read" on postcode_to_water_company for select using (true);
create policy "public read" on hardness_geology_estimate for select using (true);
create policy "public read" on air_quality_grid for select using (true);
create policy "public read" on radon_grid for select using (true);
create policy "public read" on noise_grid for select using (true);
create policy "public read" on light_pollution_grid for select using (true);
create policy "public read" on green_space for select using (true);
create policy "public read" on historic_landfill for select using (true);

-- epc_cache, postcode_cache, and leads get no public policies at all:
-- with RLS enabled and zero policies, only the service_role key
-- (which bypasses RLS) can touch them. That key must stay server-side only.
