#!/bin/bash
# Crea el rol de aplicación y las 3 bases de datos del MVP.
# Se ejecuta una sola vez en el primer arranque del contenedor postgres.
set -euo pipefail

: "${POS_DB_USER:?POS_DB_USER no definido}"
: "${POS_DB_PASSWORD:?POS_DB_PASSWORD no definido}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE ROLE ${POS_DB_USER} LOGIN PASSWORD '${POS_DB_PASSWORD}';
    CREATE DATABASE users_db   OWNER ${POS_DB_USER};
    CREATE DATABASE clients_db OWNER ${POS_DB_USER};
    CREATE DATABASE sales_db   OWNER ${POS_DB_USER};
EOSQL
