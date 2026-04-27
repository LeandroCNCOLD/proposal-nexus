-- CN ColdPro — módulo de cálculo térmico e dimensionamento

create table if not exists public.coldpro_projects (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid null references public.proposals(id) on delete set null,
  customer_id uuid null,
  name text not null,
  application_type text not null default 'cold_room',
  status text not null default 'draft',
  revision integer not null default 0,
  notes text null,
  calculated_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coldpro_insulation_materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  material_type text not null,
  conductivity_w_m_k numeric not null,
  conductivity_kcal_h_m_c numeric not null,
  default_thickness_mm numeric null,
  source text null,
  source_reference text null,
  created_at timestamptz not null default now()
);

create table if not exists public.coldpro_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text null,
  initial_freezing_temp_c numeric null,
  specific_heat_above_kcal_kg_c numeric not null default 0,
  specific_heat_below_kcal_kg_c numeric not null default 0,
  latent_heat_kcal_kg numeric not null default 0,
  density_kg_m3 numeric null,
  water_content_percent numeric null,
  source text null,
  source_reference text null,
  created_at timestamptz not null default now()
);

create table if not exists public.coldpro_environments (
  id uuid primary key default gen_random_uuid(),
  coldpro_project_id uuid not null references public.coldpro_projects(id) on delete cascade,
  name text not null,
  environment_type text not null default 'cold_room',
  length_m numeric not null default 0,
  width_m numeric not null default 0,
  height_m numeric not null default 0,
  volume_m3 numeric not null default 0,
  internal_temp_c numeric not null default 0,
  external_temp_c numeric not null default 35,
  floor_temp_c numeric null,
  relative_humidity_percent numeric null,
  insulation_material_id uuid null references public.coldpro_insulation_materials(id),
  wall_thickness_mm numeric not null default 100,
  ceiling_thickness_mm numeric not null default 100,
  floor_thickness_mm numeric not null default 0,
  has_floor_insulation boolean not null default false,
  operation_hours_day numeric not null default 24,
  compressor_runtime_hours_day numeric not null default 20,
  door_openings_per_day numeric not null default 0,
  door_width_m numeric not null default 0,
  door_height_m numeric not null default 0,
  infiltration_factor numeric not null default 0,
  people_count numeric not null default 0,
  people_hours_day numeric not null default 0,
  lighting_power_w numeric not null default 0,
  lighting_hours_day numeric not null default 0,
  motors_power_kw numeric not null default 0,
  motors_hours_day numeric not null default 0,
  fans_kcal_h numeric not null default 0,
  defrost_kcal_h numeric not null default 0,
  other_kcal_h numeric not null default 0,
  safety_factor_percent numeric not null default 10,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coldpro_environment_products (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.coldpro_environments(id) on delete cascade,
  product_id uuid null references public.coldpro_products(id) on delete set null,
  product_name text not null,
  mass_kg_day numeric not null default 0,
  mass_kg_hour numeric not null default 0,
  inlet_temp_c numeric not null default 0,
  outlet_temp_c numeric not null default 0,
  process_time_h numeric not null default 24,
  packaging_mass_kg_day numeric not null default 0,
  packaging_specific_heat_kcal_kg_c numeric not null default 0.4,
  packaging_inlet_temp_c numeric null,
  packaging_outlet_temp_c numeric null,
  specific_heat_above_kcal_kg_c numeric not null default 0,
  specific_heat_below_kcal_kg_c numeric not null default 0,
  latent_heat_kcal_kg numeric not null default 0,
  initial_freezing_temp_c numeric null,
  created_at timestamptz not null default now()
);

create table if not exists public.coldpro_tunnels (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.coldpro_environments(id) on delete cascade,
  tunnel_type text not null default 'blast_freezer',
  operation_mode text not null default 'continuous',
  product_name text not null default 'Produto',
  product_thickness_mm numeric not null default 0,
  product_unit_weight_kg numeric not null default 0,
  units_per_cycle numeric not null default 0,
  cycles_per_hour numeric not null default 0,
  mass_kg_hour numeric not null default 0,
  inlet_temp_c numeric not null default 0,
  outlet_temp_c numeric not null default -18,
  freezing_temp_c numeric null default -1.5,
  air_temp_c numeric not null default -35,
  air_velocity_m_s numeric not null default 3,
  process_time_min numeric not null default 60,
  specific_heat_above_kcal_kg_c numeric not null default 0.8,
  specific_heat_below_kcal_kg_c numeric not null default 0.4,
  latent_heat_kcal_kg numeric not null default 60,
  packaging_mass_kg_hour numeric not null default 0,
  packaging_specific_heat_kcal_kg_c numeric not null default 0.4,
  belt_motor_kw numeric not null default 0,
  internal_fans_kw numeric not null default 0,
  other_internal_kw numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coldpro_results (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.coldpro_environments(id) on delete cascade,
  transmission_kcal_h numeric not null default 0,
  product_kcal_h numeric not null default 0,
  packaging_kcal_h numeric not null default 0,
  infiltration_kcal_h numeric not null default 0,
  people_kcal_h numeric not null default 0,
  lighting_kcal_h numeric not null default 0,
  motors_kcal_h numeric not null default 0,
  tunnel_internal_load_kcal_h numeric not null default 0,
  fans_kcal_h numeric not null default 0,
  defrost_kcal_h numeric not null default 0,
  other_kcal_h numeric not null default 0,
  subtotal_kcal_h numeric not null default 0,
  safety_factor_percent numeric not null default 0,
  safety_kcal_h numeric not null default 0,
  total_required_kcal_h numeric not null default 0,
  total_required_kw numeric not null default 0,
  total_required_tr numeric not null default 0,
  calculation_input jsonb not null default '{}'::jsonb,
  calculation_breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.coldpro_equipment_catalog (
  id uuid primary key default gen_random_uuid(),
  model text not null,
  application_type text not null,
  capacity_kcal_h numeric not null,
  capacity_kw numeric not null,
  evaporation_temp_c numeric null,
  ambient_temp_c numeric null,
  refrigerant text null,
  voltage text null,
  air_flow_m3_h numeric not null default 0,
  air_throw_m numeric null,
  compressor_type text null,
  defrost_type text null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.coldpro_equipment_selections (
  id uuid primary key default gen_random_uuid(),
  environment_id uuid not null references public.coldpro_environments(id) on delete cascade,
  equipment_id uuid null references public.coldpro_equipment_catalog(id) on delete set null,
  model text not null,
  quantity numeric not null default 1,
  capacity_unit_kcal_h numeric not null default 0,
  capacity_total_kcal_h numeric not null default 0,
  air_flow_unit_m3_h numeric not null default 0,
  air_flow_total_m3_h numeric not null default 0,
  air_throw_m numeric null,
  surplus_kcal_h numeric not null default 0,
  surplus_percent numeric not null default 0,
  air_changes_hour numeric not null default 0,
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_coldpro_projects_proposal_id on public.coldpro_projects(proposal_id);
create index if not exists idx_coldpro_env_project_id on public.coldpro_environments(coldpro_project_id);
create index if not exists idx_coldpro_env_products_env_id on public.coldpro_environment_products(environment_id);
create index if not exists idx_coldpro_tunnels_env_id on public.coldpro_tunnels(environment_id);
create index if not exists idx_coldpro_results_env_id on public.coldpro_results(environment_id);
create index if not exists idx_coldpro_selection_env_id on public.coldpro_equipment_selections(environment_id);

alter table public.coldpro_projects enable row level security;
alter table public.coldpro_insulation_materials enable row level security;
alter table public.coldpro_products enable row level security;
alter table public.coldpro_environments enable row level security;
alter table public.coldpro_environment_products enable row level security;
alter table public.coldpro_tunnels enable row level security;
alter table public.coldpro_results enable row level security;
alter table public.coldpro_equipment_catalog enable row level security;
alter table public.coldpro_equipment_selections enable row level security;

create policy "coldpro_projects_auth" on public.coldpro_projects for all to authenticated using (true) with check (true);
create policy "coldpro_insulation_auth" on public.coldpro_insulation_materials for all to authenticated using (true) with check (true);
create policy "coldpro_products_auth" on public.coldpro_products for all to authenticated using (true) with check (true);
create policy "coldpro_env_auth" on public.coldpro_environments for all to authenticated using (true) with check (true);
create policy "coldpro_env_products_auth" on public.coldpro_environment_products for all to authenticated using (true) with check (true);
create policy "coldpro_tunnels_auth" on public.coldpro_tunnels for all to authenticated using (true) with check (true);
create policy "coldpro_results_auth" on public.coldpro_results for all to authenticated using (true) with check (true);
create policy "coldpro_equipment_catalog_auth" on public.coldpro_equipment_catalog for all to authenticated using (true) with check (true);
create policy "coldpro_equipment_selections_auth" on public.coldpro_equipment_selections for all to authenticated using (true) with check (true);

-- Triggers de updated_at (reaproveita função existente public.set_updated_at)
create trigger set_updated_at_coldpro_projects before update on public.coldpro_projects for each row execute function public.set_updated_at();
create trigger set_updated_at_coldpro_environments before update on public.coldpro_environments for each row execute function public.set_updated_at();
create trigger set_updated_at_coldpro_tunnels before update on public.coldpro_tunnels for each row execute function public.set_updated_at();

-- Seeds iniciais (parametrizáveis)
insert into public.coldpro_insulation_materials
(name, material_type, conductivity_w_m_k, conductivity_kcal_h_m_c, default_thickness_mm, source, source_reference)
values
('PIR', 'rigid_panel', 0.022, 0.0189, 100, 'internal_reference', 'Valor inicial parametrizável; validar com fornecedor/fonte licenciada'),
('PUR', 'rigid_panel', 0.024, 0.0206, 100, 'internal_reference', 'Valor inicial parametrizável; validar com fornecedor/fonte licenciada'),
('EPS', 'rigid_panel', 0.036, 0.0310, 100, 'internal_reference', 'Valor inicial parametrizável; validar com fornecedor/fonte licenciada')
on conflict do nothing;

insert into public.coldpro_products
(name, category, initial_freezing_temp_c, specific_heat_above_kcal_kg_c, specific_heat_below_kcal_kg_c, latent_heat_kcal_kg, source, source_reference)
values
('Carne bovina', 'proteinas', -1.7, 0.77, 0.40, 58, 'internal_reference', 'Validar contra base técnica licenciada'),
('Frango', 'proteinas', -2.0, 0.79, 0.41, 60, 'internal_reference', 'Validar contra base técnica licenciada'),
('Peixe', 'proteinas', -2.2, 0.82, 0.43, 62, 'internal_reference', 'Validar contra base técnica licenciada'),
('Produto refrigerado genérico', 'generico', null, 0.85, 0.45, 0, 'internal_reference', 'Base genérica para simulação'),
('Produto congelado genérico', 'generico', -1.5, 0.80, 0.40, 60, 'internal_reference', 'Base genérica para simulação')
on conflict do nothing;

insert into public.coldpro_equipment_catalog
(model, application_type, capacity_kcal_h, capacity_kw, evaporation_temp_c, ambient_temp_c, refrigerant, voltage, air_flow_m3_h, air_throw_m, compressor_type, defrost_type)
values
('CN 650 MTA', 'antechamber', 12700, 14.77, -5, 35, 'R404A', '380V/3F', 8190, 30, 'Scroll', 'Elétrico'),
('CN 1000 MT', 'cold_room', 21000, 24.42, -8, 35, 'R404A', '380V/3F', 19760, 48, 'Semi-hermético', 'Gás quente'),
('CN 2000 MT', 'cold_room', 21000, 24.42, -8, 35, 'R404A', '380V/3F', 19760, 48, 'Semi-hermético', 'Gás quente'),
('CN 2000 LT', 'freezer_room', 18570, 21.59, -28, 35, 'R404A', '380V/3F', 19745, 50, 'Semi-hermético', 'Gás quente'),
('CN 2000 LT Túnel', 'blast_freezer', 18570, 21.59, -35, 35, 'R404A', '380V/3F', 19745, 50, 'Semi-hermético', 'Gás quente')
on conflict do nothing;