-- Supabase breaking change fix: Explicit grants to Data API roles for the "public" schema
-- Enforced for all projects starting Oct 30, 2026.

-- 1. Ensure the core roles have usage on the public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Grant privileges on all existing tables, routines, and sequences
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 3. Alter default privileges so future tables, routines, and sequences automatically receive these grants
-- Note: 'postgres' and 'supabase_admin' are typical owners in Supabase.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
