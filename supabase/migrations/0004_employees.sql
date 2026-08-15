-- =====================================================================
-- RCT APPLICATION | Migration 0004 - Employees, skills, coverage
-- =====================================================================

create table if not exists public.departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  created_at  timestamptz not null default now()
);

create table if not exists public.employees (
  id                uuid primary key default gen_random_uuid(),
  employee_code     text not null unique,          -- EMP-0001
  profile_id        uuid unique references public.profiles(id) on delete set null,
  full_name         text not null,
  email             citext not null,
  phone             text,
  alternate_phone   text,
  avatar_url        text,
  job_title         text,
  department_id     uuid references public.departments(id) on delete set null,
  role              app.user_role not null default 'engineer',
  reports_to        uuid references public.employees(id) on delete set null,
  joining_date      date,
  date_of_birth     date,
  nationality       text,
  emirates_id       text,
  status            app.record_status not null default 'active',
  -- Engineer capacity used by the assignment screen and workload charts.
  max_open_tickets  int not null default 15 check (max_open_tickets > 0),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint employees_not_own_manager check (reports_to is null or reports_to <> id)
);

create index if not exists idx_employees_role       on public.employees(role);
create index if not exists idx_employees_status     on public.employees(status);
create index if not exists idx_employees_department on public.employees(department_id);
create index if not exists idx_employees_name_trgm
  on public.employees using gin (full_name gin_trgm_ops);

-- ---------------------------------------------------------------------
-- Skills and certifications
-- ---------------------------------------------------------------------
create table if not exists public.skills (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  category   text,
  created_at timestamptz not null default now()
);

create table if not exists public.employee_skills (
  employee_id uuid not null references public.employees(id) on delete cascade,
  skill_id    uuid not null references public.skills(id)    on delete cascade,
  proficiency int  not null default 3 check (proficiency between 1 and 5),
  primary key (employee_id, skill_id)
);

create table if not exists public.employee_certifications (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees(id) on delete cascade,
  name         text not null,
  issuer       text,
  issued_on    date,
  expires_on   date,
  reference_no text,
  document_url text,
  created_at   timestamptz not null default now(),

  constraint employee_certifications_dates
    check (issued_on is null or expires_on is null or expires_on >= issued_on)
);

create index if not exists idx_emp_cert_employee on public.employee_certifications(employee_id);
create index if not exists idx_emp_cert_expiry   on public.employee_certifications(expires_on);

-- ---------------------------------------------------------------------
-- Coverage: which engineers serve which customers / sites.
-- Drives default assignment suggestions and engineer RLS scope.
-- ---------------------------------------------------------------------
create table if not exists public.employee_customers (
  employee_id uuid not null references public.employees(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  is_primary  boolean not null default false,
  assigned_at timestamptz not null default now(),
  primary key (employee_id, customer_id)
);

create index if not exists idx_employee_customers_customer on public.employee_customers(customer_id);

create table if not exists public.employee_branches (
  employee_id uuid not null references public.employees(id) on delete cascade,
  branch_id   uuid not null references public.branches(id)  on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (employee_id, branch_id)
);

create index if not exists idx_employee_branches_branch on public.employee_branches(branch_id);

select app.attach_touch_trigger('public.employees');

-- Close the remaining profile / customer foreign keys.
alter table public.profiles
  drop constraint if exists profiles_employee_fk,
  add  constraint profiles_employee_fk
       foreign key (employee_id) references public.employees(id) on delete set null;

alter table public.customers
  drop constraint if exists customers_account_manager_fk,
  add  constraint customers_account_manager_fk
       foreign key (account_manager_id) references public.employees(id) on delete set null;
