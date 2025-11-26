import sqlite3
import os

DB_PATH = os.path.join('instance', 'gastos.db')

def migrar_db():
    if not os.path.exists(DB_PATH):
        print(f"Error: No se encontró {DB_PATH}")
        return

    con = sqlite3.connect(DB_PATH)
    cursor = con.cursor()

    try:
        print("Intentando vincular Cuotas con Tarjetas...")
        # Agregamos el campo recurrente_id (puede ser NULL si es un plan en efectivo)
        cursor.execute("ALTER TABLE planes_cuotas ADD COLUMN recurrente_id INTEGER REFERENCES gastos_recurrentes(id) ON DELETE SET NULL")
        con.commit()
        print("¡Éxito! Columna 'recurrente_id' agregada.")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e):
            print("Aviso: La columna ya existía.")
        else:
            print(f"Error: {e}")
    finally:
        con.close()

if __name__ == "__main__":
    migrar_db()