import { z } from 'zod';
export const UserSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    created_at: z.date(),
});
export const SQL = `
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  file_key text not null,
  filename text not null,
  created_at timestamptz not null default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  report_id uuid not null references reports(id) on delete cascade,
  status text not null check (status in ('queued','processing','complete','failed')) default 'queued',
  progress text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists analysis_results (
  report_id uuid primary key references reports(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  result_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists dispute_letters (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  bureau text not null,
  file_key text not null,
  content_text text,
  created_at timestamptz not null default now()
);

create index if not exists idx_jobs_status on jobs(status);
create index if not exists idx_letters_report on dispute_letters(report_id);
`;
//# sourceMappingURL=schema.js.map