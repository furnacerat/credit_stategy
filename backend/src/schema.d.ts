import { z } from 'zod';
export declare const UserSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    created_at: z.ZodDate;
}, z.core.$strip>;
export type User = z.infer<typeof UserSchema>;
export declare const SQL = "\ncreate table if not exists reports (\n  id uuid primary key default gen_random_uuid(),\n  user_id text not null,\n  file_key text not null,\n  filename text not null,\n  created_at timestamptz not null default now()\n);\n\ncreate table if not exists jobs (\n  id uuid primary key default gen_random_uuid(),\n  user_id text not null,\n  report_id uuid not null references reports(id) on delete cascade,\n  status text not null check (status in ('queued','processing','complete','failed')) default 'queued',\n  progress text,\n  error text,\n  created_at timestamptz not null default now(),\n  updated_at timestamptz not null default now()\n);\n\ncreate table if not exists analysis_results (\n  report_id uuid primary key references reports(id) on delete cascade,\n  user_id text not null,\n  result_json jsonb not null,\n  created_at timestamptz not null default now()\n);\n\ncreate index if not exists idx_jobs_status on jobs(status);\n";
//# sourceMappingURL=schema.d.ts.map