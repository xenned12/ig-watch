-- Track the account search running for a niche so repeat requests reuse it.
alter table niche_top_accounts
  alter column accounts set default '[]'::jsonb,
  alter column fetched_at drop not null,
  alter column fetched_at drop default,
  add column pending_run_id text,
  add column pending_since timestamptz;
