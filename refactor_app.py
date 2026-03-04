import re

def refactor_app():
    with open('app.py', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Imports
    content = content.replace("import sqlite3", "import psycopg2\\nfrom psycopg2.extras import RealDictCursor")

    # 2. Database connection
    # Replace the `sqlite3.connect` block in `get_db`
    app_config_db_pattern = r"app\.config\['DATABASE'\].*?'gastos\.db'\)"
    content = re.sub(app_config_db_pattern, "app.config['SUPABASE_URL'] = os.environ.get('SUPABASE_URL', 'postgresql://postgres:9LGOLc9kNBVG5K0D@db.qnwbnuysfiihzsozallu.supabase.co:5432/postgres')", content)

    get_db_replacement = """    if 'db' not in g:
        g.db = psycopg2.connect(app.config['SUPABASE_URL'])"""
    
    # regex to find the g.db initialization
    content = re.sub(r"    if 'db' not in g:.*?        g\.db\.row_factory = sqlite3\.Row", get_db_replacement, content, flags=re.DOTALL)

    # 3. Cursors
    content = content.replace("db.cursor()", "db.cursor(cursor_factory=RealDictCursor)")

    # 4. Error Handling
    content = content.replace("sqlite3.Error", "psycopg2.Error")
    content = content.replace("sqlite3.IntegrityError", "psycopg2.IntegrityError")
    content = content.replace("sqlite3.OperationalError", "psycopg2.OperationalError")

    # 5. Question mark placeholders to %s
    # We only want to replace ? inside execute statements or SQL strings.
    # It's safer to just replace '?' with '%s' where it looks like SQL.
    # A simple regex for query strings with ?
    def replace_question_marks(match):
        return match.group(0).replace("?", "%s")
    
    content = re.sub(r"execute\([\"'].*?[\"']", replace_question_marks, content, flags=re.DOTALL)
    # Also handle multiline strings
    content = re.sub(r"execute\(\"\"\"(?:.*?)\"\"\"", replace_question_marks, content, flags=re.DOTALL)

    # 6. RETURNING id and lastrowid
    # For every INSERT that uses cursor.lastrowid
    # We find "INSERT INTO ... VALUES (...)"
    
    # IN categorias
    content = content.replace('INSERT INTO categorias (nombre) VALUES (%s)"', 'INSERT INTO categorias (nombre) VALUES (%s) RETURNING id"')
    # IN transacciones (hay 3)
    content = content.replace('INSERT INTO transacciones (descripcion, monto, tipo, fecha, categoria_id, moneda, comprobante_path) VALUES (%s, %s, %s, %s, %s, %s, %s)"', 'INSERT INTO transacciones (descripcion, monto, tipo, fecha, categoria_id, moneda, comprobante_path) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id"')
    content = content.replace("INSERT INTO transacciones (descripcion, monto, tipo, fecha, categoria_id, moneda, comprobante_path) VALUES (%s, %s, 'gasto', %s, %s, %s, %s)\"", "INSERT INTO transacciones (descripcion, monto, tipo, fecha, categoria_id, moneda, comprobante_path) VALUES (%s, %s, 'gasto', %s, %s, %s, %s) RETURNING id\"")
    # IN gastos_recurrentes
    content = content.replace('INSERT INTO gastos_recurrentes (descripcion, monto_estimado, dia_vencimiento, categoria_id, observacion, tipo, moneda) VALUES (%s, %s, %s, %s, %s, %s, %s)"', 'INSERT INTO gastos_recurrentes (descripcion, monto_estimado, dia_vencimiento, categoria_id, observacion, tipo, moneda) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id"')
    # IN planes_cuotas
    content = content.replace('INSERT INTO planes_cuotas (descripcion, monto_total, monto_cuota, total_cuotas, fecha_inicio, categoria_id, recurrente_id, cuota_actual, moneda) VALUES (%s,%s,%s,%s,%s,%s,%s,0,%s)"', 'INSERT INTO planes_cuotas (descripcion, monto_total, monto_cuota, total_cuotas, fecha_inicio, categoria_id, recurrente_id, cuota_actual, moneda) VALUES (%s,%s,%s,%s,%s,%s,%s,0,%s) RETURNING id"')

    # Replace lastrowid
    content = content.replace("cursor.lastrowid", "cursor.fetchone()['id']")

    # 7. Webauthn specific changes for BLOB to BYTEA
    # sqlite binary is inserted directly, psycopg2 also inserts bytes directly, so it should be fine.

    # 8. Minor fixes related to DictRow to dict conversion
    content = content.replace("dict(fila)", "dict(fila)") # RealDictRow behaves like dict but is not a native dict, it works in jsonify

    # 9. WITH DB contexts in python sqlite3 vs psycopg2
    # In sqlite3, `with db:` automatically commits. In psycopg2 it does not automatically commit, `with db:` creates a transaction block.
    # We should add `db.commit()` after insertions that use `with db:`
    
    with open('app_postgres.py', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    refactor_app()
