-- Each run analyses posts from a chosen date range (max 90 days).
-- Older runs have no range and are treated as the 90 days before they started.
alter table runs
  add column range_since timestamptz,
  add column range_until timestamptz;

alter table runs
  add constraint runs_range_valid check (
    (range_since is null and range_until is null)
    or (range_since < range_until and range_until - range_since <= interval '90 days 1 hour')
  );
