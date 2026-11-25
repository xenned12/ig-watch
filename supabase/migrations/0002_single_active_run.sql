-- At most one run may be active (status not done/failed) at any time.
create unique index one_active_run on runs ((true)) where status not in ('done','failed');
