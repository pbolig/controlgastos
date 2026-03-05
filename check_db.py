import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(os.environ.get("SUPABASE_URL"))
cursor = conn.cursor(cursor_factory=RealDictCursor)
cursor.execute("SELECT id, descripcion, comprobante_path FROM transacciones ORDER BY id DESC LIMIT 5")
rows = cursor.fetchall()
for r in rows:
    print(r)
