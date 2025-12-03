import sqlite3
import os

# --- ATENCIÓN: BORRAR LA BBDD ANTIGUA ---
DB_PATH = os.path.join('instance', 'gastos.db')
if os.path.exists(DB_PATH):
    os.remove(DB_PATH)
    print("Base de datos anterior eliminada.")
# ----------------------------------------

os.makedirs('instance', exist_ok=True)

try:
    con = sqlite3.connect(DB_PATH)
    cursor = con.cursor()
    con.execute("PRAGMA foreign_keys = ON;")
    print("Conexión a SQLite exitosa (nueva BBDD creada).")

    # --- Crear Tablas ---

    # Tabla 1: Categorías (sin cambios)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE
    )
    ''')
    print("Tabla 'categorias' creada.")

    # Tabla 2: Transacciones (CONSOLIDADA)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS transacciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        descripcion TEXT NOT NULL,
        monto REAL NOT NULL,
        tipo TEXT NOT NULL CHECK(tipo IN ('ingreso', 'gasto')),
        fecha DATE NOT NULL,
        categoria_id INTEGER,
        moneda TEXT DEFAULT 'ARS',          -- <-- Añadido de migracion_multimoneda
        comprobante_path TEXT,              -- <-- Añadido de migracion_comprobantes
        FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL
    )
    ''')
    print("Tabla 'transacciones' creada.")

    # Tabla 3: Gastos Recurrentes (CONSOLIDADA)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS gastos_recurrentes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        descripcion TEXT NOT NULL,
        monto_estimado REAL NOT NULL,
        dia_vencimiento INTEGER NOT NULL,
        categoria_id INTEGER NOT NULL,
        observacion TEXT,
        tipo TEXT DEFAULT 'gasto',          -- <-- Añadido previamente
        moneda TEXT DEFAULT 'ARS',          -- <-- Añadido de migracion_multimoneda
        FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT
    )
    ''')
    print("Tabla 'gastos_recurrentes' (modificada) creada.")
    
    # Tabla 4: Log de Pagos Recurrentes (sin cambios)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS pagos_recurrentes_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recurrente_id INTEGER,
        transaccion_id INTEGER,
        mes INTEGER NOT NULL,
        anio INTEGER NOT NULL,
        FOREIGN KEY (recurrente_id) REFERENCES gastos_recurrentes(id),
        FOREIGN KEY (transaccion_id) REFERENCES transacciones(id)
    )
    ''')
    print("Tabla 'pagos_recurrentes_log' creada.")

    # --- Tabla 5: Planes de Cuotas (CONSOLIDADA) ---
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS planes_cuotas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        descripcion TEXT NOT NULL,
        monto_total REAL NOT NULL,
        monto_cuota REAL NOT NULL,
        total_cuotas INTEGER NOT NULL,
        cuota_actual INTEGER DEFAULT 0,
        fecha_inicio DATE NOT NULL,
        categoria_id INTEGER NOT NULL,
        ultimo_pago_mes INTEGER,
        ultimo_pago_anio INTEGER,
        recurrente_id INTEGER,              -- <-- Añadido de migracion_local (para tarjetas)
        moneda TEXT DEFAULT 'ARS',          -- <-- Añadido de migracion_multimoneda

        FOREIGN KEY (recurrente_id) REFERENCES gastos_recurrentes(id) ON DELETE SET NULL,
        FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT
    )
    ''')
    print("Tabla 'planes_cuotas' (modificada) creada.")

    # --- DATOS INICIALES ---
    categorias_iniciales = [
        ('Salario',), ('Supermercado',), ('Alquiler',), ('Servicios (Luz, Agua, Gas)',),
        ('Internet y Telefonía',), ('Transporte',), ('Ocio y Salidas',),
        ('Restaurantes',), ('Suscripciones (Streaming)',), ('Otros Ingresos',),
        ('Otros Gastos',), ('Tecnología',), ('Ropa',), ('Tarjeta de Crédito',)
    ]
    cursor.executemany("INSERT INTO categorias (nombre) VALUES (?)", categorias_iniciales)
    print(f"Insertadas {len(categorias_iniciales)} categorías iniciales.")

    con.commit()
    print("Tablas y datos iniciales creados exitosamente.")

except sqlite3.Error as e:
    print(f"Error al crear la base de datos: {e}")
finally:
    if con:
        con.close()