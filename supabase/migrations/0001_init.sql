create table runs (
  id uuid primary key default gen_random_uuid(),
  niche text not null,
  client_handle text not null,
  competitor_handles text[] not null default '{}',
  status text not null default 'fetching'
    check (status in ('fetching','transcribing','analyzing','done','failed')),
  failed_step text check (failed_step in ('fetch','transcribe','analyze')),
  error text,
  skipped jsonb not null default '[]',
  videos_found jsonb not null default '{}',
  remaining int not null default 0,
  apify_run_id text,
  created_at timestamptz not null default now()
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  handle text not null,
  is_client boolean not null,
  ig_url text not null,
  posted_at timestamptz not null,
  views int,
  likes int not null default 0,
  comments int not null default 0,
  duration_s int not null default 0,
  rank_metric text not null check (rank_metric in ('views','likes')),
  rank int not null,
  video_url text,
  caption text not null default ''
);
create index posts_run_id_idx on posts (run_id);

create table transcripts (
  post_id uuid primary key references posts(id) on delete cascade,
  text text not null,
  segments jsonb not null default '[]',
  source text not null check (source in ('whisper','caption'))
);

create table analyses (
  run_id uuid primary key references runs(id) on delete cascade,
  patterns jsonb not null default '[]',
  gaps jsonb not null default '[]',
  recommendations jsonb not null default '[]',
  scripts jsonb not null default '[]'
);

create table run_events (
  id bigint generated always as identity primary key,
  run_id uuid not null references runs(id) on delete cascade,
  at timestamptz not null default now(),
  message text not null
);
create index run_events_run_id_at_idx on run_events (run_id, at);

create table run_starts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index run_starts_ip_created_idx on run_starts (ip_hash, created_at);

alter table runs enable row level security;
alter table posts enable row level security;
alter table transcripts enable row level security;
alter table analyses enable row level security;
alter table run_events enable row level security;
alter table run_starts enable row level security;

create function decrement_remaining(p_run uuid) returns int language sql as $$
  update runs set remaining = remaining - 1 where id = p_run returning remaining $$;
