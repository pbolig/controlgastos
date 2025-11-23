import sqlite3
import os

# Ruta a tu base de datos local
DB_PATH = os.path.join('instance', 'gastos.db')

def migrar_db():
    if not os.path.exists(DB_PATH):
        print(f"Error: No se encontró la base de datos en {DB_PATH}")
        return

    print(f"Conectando a {DB_PATH}...")
    con = sqlite3.connect(DB_PATH)
    cursor = con.cursor()

    try:
        # Intentamos agregar la columna 'tipo'
        print("Intentando agregar columna 'tipo' a 'gastos_recurrentes'...")
        cursor.execute("ALTER TABLE gastos_recurrentes ADD COLUMN tipo TEXT DEFAULT 'gasto'")
        con.commit()
        print("¡Éxito! Columna agregada correctamente.")
        
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e):
            print("Aviso: La columna 'tipo' ya existía. No se hicieron cambios.")
        else:
            print(f"Error inesperado: {e}")
    finally:
        con.close()

if __name__ == "__main__":
    migrar_db()