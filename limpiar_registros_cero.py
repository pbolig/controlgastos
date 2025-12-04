import sqlite3
import os

# MODIFICACIÓN: Apuntamos directamente a la ruta de la base de datos de producción
# que se usa en el volumen de Docker.
DB_PATH = '/var/www/gastos-data/gastos.db'

def limpiar_registros_cero():
    """
    Busca y elimina registros de la tabla 'transacciones' cuyo monto sea cero,
    previa confirmación del usuario.
    """
    if not os.path.exists(DB_PATH):
        print(f"Error: No se encontró la base de datos en la ruta: {DB_PATH}")
        return

    con = sqlite3.connect(DB_PATH)
    cursor = con.cursor()

    try:
        # Primero, contamos cuántos registros se verán afectados
        cursor.execute("SELECT COUNT(*) FROM transacciones WHERE monto = 0")
        count = cursor.fetchone()[0]

        if count == 0:
            print("No se encontraron registros con monto cero. No se necesita ninguna acción.")
            return

        print(f"\nADVERTENCIA: Se encontraron {count} registros con monto cero en el historial de movimientos.")
        
        # Pedimos confirmación al usuario
        confirmacion = input(f"¿Estás seguro de que quieres eliminar estos {count} registros de forma permanente? (escribe 'si' para confirmar): ")

        if confirmacion.lower() == 'si':
            print("\nEliminando registros...")
            cursor.execute("DELETE FROM transacciones WHERE monto = 0")
            con.commit()
            print(f"¡Éxito! Se eliminaron {cursor.rowcount} registros.")
        else:
            print("\nOperación cancelada. No se realizaron cambios.")

    except sqlite3.Error as e:
        print(f"Error de base de datos: {e}")
    finally:
        con.close()

if __name__ == "__main__":
    limpiar_registros_cero()