-- Cached "top accounts" suggestions per preset niche (refreshed weekly by the app).
create table niche_top_accounts (
  niche text primary key,          -- lower-case niche from the suggestion list
  accounts jsonb not null,         -- [{handle, fullName, followers, verified}]
  fetched_at timestamptz not null default now()
);

alter table niche_top_accounts enable row level security;
