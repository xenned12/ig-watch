alter table runs add column started_at timestamptz not null default now();
