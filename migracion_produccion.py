import sqlite3
import os

DB_PATH = os.path.join('instance', 'gastos.db')

def get_column_names(cursor, table_name):
    """Obtiene los nombres de las columnas de una tabla."""
    cursor.execute(f"PRAGMA table_info({table_name})")
    return {row[1] for row in cursor.fetchall()}

def migrar_produccion():
    """
    Aplica todas las migraciones de esquema necesarias a la base de datos de producción
    sin perder datos. Es seguro ejecutar este script múltiples veces.
    """
    if not os.path.exists(DB_PATH):
        print(f"Error: No se encontró la base de datos en la ruta: {DB_PATH}")
        print("Este script es solo para actualizar una base de datos existente.")
        return

    print(f"Conectando a la base de datos en: {DB_PATH}")
    con = sqlite3.connect(DB_PATH)
    cursor = con.cursor()

    # --- Lista de todas las migraciones necesarias ---
    # (tabla, nombre_columna, definicion_columna)
    migraciones = [
        ('transacciones', 'moneda', 'TEXT DEFAULT "ARS"'),
        ('transacciones', 'comprobante_path', 'TEXT'),
        ('gastos_recurrentes', 'tipo', 'TEXT DEFAULT "gasto"'),
        ('gastos_recurrentes', 'moneda', 'TEXT DEFAULT "ARS"'),
        ('planes_cuotas', 'categoria_id', 'INTEGER'), # NOT NULL se maneja con update
        ('planes_cuotas', 'ultimo_pago_mes', 'INTEGER'),
        ('planes_cuotas', 'ultimo_pago_anio', 'INTEGER'),
        ('planes_cuotas', 'recurrente_id', 'INTEGER'),
        ('planes_cuotas', 'moneda', 'TEXT DEFAULT "ARS"'),
    ]

    print("\nIniciando revisión del esquema de la base de datos...")

    for tabla, columna, definicion in migraciones:
        try:
            columnas_existentes = get_column_names(cursor, tabla)
            if columna not in columnas_existentes:
                print(f"  -> Aplicando migración: Agregando columna '{columna}' a la tabla '{tabla}'...")
                cursor.execute(f"ALTER TABLE {tabla} ADD COLUMN {columna} {definicion}")
                con.commit()
                print(f"     ¡Éxito! Columna '{columna}' agregada.")
            else:
                print(f"  -> Verificado: La columna '{columna}' ya existe en la tabla '{tabla}'. No se necesita acción.")
        except sqlite3.OperationalError as e:
            print(f"     Error al migrar la tabla '{tabla}': {e}")

    print("\nRevisión del esquema completada.")
    con.close()
    print("Conexión a la base de datos cerrada.")


if __name__ == "__main__":
    migrar_produccion()