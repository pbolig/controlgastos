import sqlite3
import psycopg2
from psycopg2.extras import execute_values
import os
from dotenv import load_dotenv

load_dotenv()

SQLITE_DB = 'gastos_vps.db'
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'postgresql://postgres:9LGOLc9kNBVG5K0D@db.qnwbnuysfiihzsozallu.supabase.co:5432/postgres')

def migrate_retry():
    sl_conn = sqlite3.connect(SQLITE_DB)
    sl_conn.row_factory = sqlite3.Row
    sl_cur = sl_conn.cursor()

    pg_conn = psycopg2.connect(SUPABASE_URL)
    pg_cur = pg_conn.cursor()

    tablas = ['planes_cuotas', 'pagos_recurrentes_log']

    for tabla in tablas:
        sl_cur.execute(f'SELECT * FROM {tabla}')
        filas = sl_cur.fetchall()
        
        if not filas: continue

        columnas = filas[0].keys()
        cols_str = ', '.join(columnas)
        valores = [tuple(fila[col] for col in columnas) for fila in filas]
        
        pg_cur.execute(f"TRUNCATE TABLE {tabla} CASCADE")
        pg_conn.commit()
        
        insert_query = f"INSERT INTO {tabla} ({cols_str}) VALUES %s"
        pg_cur.execute("SET session_replication_role = 'replica';")
        execute_values(pg_cur, insert_query, valores)
        pg_cur.execute("SET session_replication_role = 'origin';")
        pg_conn.commit()
        
        pg_cur.execute(f"SELECT setval('{tabla}_id_seq', COALESCE((SELECT MAX(id)+1 FROM {tabla}), 1), false);")
        pg_conn.commit()
        print(f"Migrados {len(filas)} registros a {tabla} exitosamente (FK disabled)!")

if __name__ == '__main__':
    migrate_retry()
