import sqlite3
import psycopg2
from psycopg2.extras import execute_values
import os
from dotenv import load_dotenv

load_dotenv()

# Configuración
SQLITE_DB = 'gastos_vps.db'
SUPABASE_URL = os.environ.get("SUPABASE_URL", "postgresql://postgres:9LGOLc9kNBVG5K0D@db.qnwbnuysfiihzsozallu.supabase.co:5432/postgres")

SCHEMA_PG = """
CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS transacciones (
    id SERIAL PRIMARY KEY,
    descripcion TEXT NOT NULL,
    monto REAL NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('ingreso', 'gasto')),
    fecha DATE NOT NULL,
    categoria_id INTEGER,
    moneda TEXT DEFAULT 'ARS',
    comprobante_path TEXT,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS gastos_recurrentes (
    id SERIAL PRIMARY KEY,
    descripcion TEXT NOT NULL,
    monto_estimado REAL NOT NULL,
    dia_vencimiento INTEGER NOT NULL,
    categoria_id INTEGER NOT NULL,
    observacion TEXT,
    tipo TEXT DEFAULT 'gasto',
    moneda TEXT DEFAULT 'ARS',
    FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS pagos_recurrentes_log (
    id SERIAL PRIMARY KEY,
    recurrente_id INTEGER,
    transaccion_id INTEGER,
    mes INTEGER NOT NULL,
    anio INTEGER NOT NULL,
    FOREIGN KEY (recurrente_id) REFERENCES gastos_recurrentes(id),
    FOREIGN KEY (transaccion_id) REFERENCES transacciones(id)
);

CREATE TABLE IF NOT EXISTS planes_cuotas (
    id SERIAL PRIMARY KEY,
    descripcion TEXT NOT NULL,
    monto_total REAL NOT NULL,
    monto_cuota REAL NOT NULL,
    total_cuotas INTEGER NOT NULL,
    cuota_actual INTEGER DEFAULT 0,
    fecha_inicio DATE NOT NULL,
    categoria_id INTEGER NOT NULL,
    ultimo_pago_mes INTEGER,
    ultimo_pago_anio INTEGER,
    recurrente_id INTEGER,
    moneda TEXT DEFAULT 'ARS',
    FOREIGN KEY (recurrente_id) REFERENCES gastos_recurrentes(id) ON DELETE SET NULL,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id SERIAL PRIMARY KEY,
    credential_id BYTEA NOT NULL UNIQUE,
    public_key BYTEA NOT NULL,
    sign_count INTEGER NOT NULL
);
"""

def migrate():
    print("Conectando a SQLite...")
    sl_conn = sqlite3.connect(SQLITE_DB)
    sl_conn.row_factory = sqlite3.Row
    sl_cur = sl_conn.cursor()

    print("Conectando a Supabase (PostgreSQL)...")
    pg_conn = psycopg2.connect(SUPABASE_URL)
    pg_cur = pg_conn.cursor()

    print("Creando esquema en Supabase...")
    pg_cur.execute(SCHEMA_PG)
    pg_conn.commit()

    tablas = [
        'categorias',
        'transacciones',
        'gastos_recurrentes',
        'pagos_recurrentes_log',
        'planes_cuotas',
        'webauthn_credentials'
    ]

    for tabla in tablas:
        print(f"\\nMigrando tabla: {tabla}...")
        try:
            sl_cur.execute(f"SELECT * FROM {tabla}")
            filas = sl_cur.fetchall()
            
            if not filas:
                print(f"  -> La tabla {tabla} está vacía en SQLite. Omitiendo.")
                continue

            # Obtener nombres de columnas
            columnas = filas[0].keys()
            cols_str = ", ".join(columnas)
            
            # Preparar datos para inserción (lista de tuplas)
            valores = [tuple(fila[col] for col in columnas) for fila in filas]
            
            # Limpiar tabla en Postgres antes de insertar para evitar duplicados si se corre varias veces
            pg_cur.execute(f"TRUNCATE TABLE {tabla} CASCADE")
            pg_conn.commit()
            
            # Generar placeholders %s
            insert_query = f"INSERT INTO {tabla} ({cols_str}) VALUES %s"
            
            execute_values(pg_cur, insert_query, valores)
            pg_conn.commit()
            
            # Sincronizar secuencias (importantísimo tras insertar IDs explícitamente)
            pg_cur.execute(f"SELECT setval('{tabla}_id_seq', COALESCE((SELECT MAX(id)+1 FROM {tabla}), 1), false);")
            pg_conn.commit()
            
            print(f"  -> ¡Migrados {len(filas)} registros a {tabla} exitosamente!")
            
        except sqlite3.OperationalError as e:
             if "no such table" in str(e):
                 print(f"  -> La tabla {tabla} no existe en SQLite, lo cual puede ser normal para tablas nuevas.")
             else:
                 print(f"  -> Error leyendo de SQLite en {tabla}: {e}")
        except Exception as e:
            print(f"  -> Error al migrar {tabla}: {e}")
            pg_conn.rollback()

    print("\\n¡Migración completada exitosamente!")
    sl_conn.close()
    pg_conn.close()

if __name__ == '__main__':
    migrate()
