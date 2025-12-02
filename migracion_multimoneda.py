import sqlite3
import os

DB_PATH = os.path.join('instance', 'gastos.db')

def migrar_db():
    if not os.path.exists(DB_PATH):
        print(f"Error: No se encontró {DB_PATH}")
        return

    con = sqlite3.connect(DB_PATH)
    cursor = con.cursor()

    tablas = ['transacciones', 'gastos_recurrentes', 'planes_cuotas']
    
    try:
        print("Iniciando migración multimoneda...")
        
        for tabla in tablas:
            try:
                # Agregamos columna moneda, por defecto 'ARS' para lo que ya existe
                cursor.execute(f"ALTER TABLE {tabla} ADD COLUMN moneda TEXT DEFAULT 'ARS'")
                print(f"✅ Columna 'moneda' agregada a tabla '{tabla}'.")
            except sqlite3.OperationalError as e:
                if "duplicate column" in str(e):
                    print(f"ℹ️ La tabla '{tabla}' ya tenía la columna 'moneda'.")
                else:
                    print(f"❌ Error en tabla '{tabla}': {e}")

        con.commit()
        print("Migración finalizada con éxito.")
        
    except Exception as e:
        print(f"❌ Error general: {e}")
    finally:
        con.close()

if __name__ == "__main__":
    migrar_db()