-- 010 — Restringir DEFAULT PRIVILEGES para tablas/funciones/secuencias FUTURAS
--
-- Contexto: la migración 009 estableció DEFAULT PRIVILEGES = ALL para anon,
-- authenticated y service_role. Eso significa que cualquier tabla nueva creada
-- en el schema public automáticamente recibe GRANT ALL para anon (rol público).
-- Si en el futuro se crea una tabla sin ENABLE ROW LEVEL SECURITY, anon
-- tendría acceso total → exposición de datos.
--
-- Esta migración aplica el principio de menor privilegio SOLO a las defaults
-- de tablas FUTURAS. Las tablas existentes mantienen los GRANTs ya otorgados
-- por la migración 009. Cero riesgo de romper funcionalidad actual.

-- 1) Revocar defaults amplios establecidos en 009
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON ROUTINES FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;

-- 2) Tablas futuras: anon solo SELECT; authenticated CRUD; service_role ALL
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO service_role;

-- 3) Funciones futuras: anon ninguno; authenticated EXECUTE; service_role ALL
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON ROUTINES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL PRIVILEGES ON ROUTINES TO service_role;

-- 4) Secuencias futuras: anon ninguno; authenticated USAGE (para nextval en INSERTs);
--    service_role ALL
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;
