-- LOCAL DEVELOPMENT/TEST ONLY. The official image runs this only for a new
-- empty volume. Secrets come from the untracked compose environment file.
\getenv migration_password UMBUL_MIGRATION_PASSWORD
\getenv runtime_password UMBUL_RUNTIME_PASSWORD
SELECT format('CREATE ROLE umbul_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L', :'migration_password') \gexec
SELECT format('CREATE ROLE umbul_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION PASSWORD %L', :'runtime_password') \gexec
SELECT format('ALTER DATABASE %I OWNER TO umbul_migrator', current_database()) \gexec
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database()) \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO umbul_runtime', current_database()) \gexec
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO umbul_migrator;
ALTER ROLE umbul_runtime SET search_path = public;
ALTER ROLE umbul_runtime SET statement_timeout = '8s';
ALTER ROLE umbul_runtime SET lock_timeout = '3s';
ALTER ROLE umbul_runtime SET idle_in_transaction_session_timeout = '15s';
ALTER ROLE umbul_migrator SET search_path = public;
