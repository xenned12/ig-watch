-- Newer Supabase projects no longer grant API roles access to tables created in
-- SQL, so even the server's service_role key got "permission denied for table runs".
-- The app only talks to the database from the server with service_role; RLS stays
-- on with no policies, so the browser's anon key still can't read or write any table.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function decrement_remaining(uuid) to service_role;

-- Tables, sequences and functions added by later migrations get the same access.
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
