import psycopg2
import os
from dotenv import load_dotenv

def init_dev_db():
    load_dotenv()
    db_url = os.environ.get('SUPABASE_URL')
    
    if "qnwbnuysfiihzsozallu" in db_url:
        print("⚠️  ¡CUIDADO! Parece que sigues usando la URL de PRODUCCIÓN.")
        print("Por favor, crea un proyecto nuevo en Supabase o usa un PostgreSQL local y cambia la variable SUPABASE_URL en el archivo .env antes de correr esto.")
        return

    try:
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        
        print("Conectado a la base de datos de desarrollo. Creando tablas...")

        # 1. Tabla Categorias
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS categorias (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL UNIQUE
            );
        """)

        # 2. Tabla Transacciones
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS transacciones (
                id SERIAL PRIMARY KEY,
                descripcion TEXT NOT NULL,
                monto NUMERIC(15, 2) NOT NULL,
                tipo VARCHAR(50) NOT NULL,
                fecha DATE NOT NULL,
                categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
                moneda VARCHAR(10) DEFAULT 'ARS' NOT NULL,
                comprobante_path TEXT
            );
        """)

        # 3. Tabla Gastos Recurrentes
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS gastos_recurrentes (
                id SERIAL PRIMARY KEY,
                descripcion TEXT NOT NULL,
                monto_estimado NUMERIC(15, 2) NOT NULL,
                dia_vencimiento INTEGER NOT NULL,
                categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
                observacion TEXT,
                tipo VARCHAR(50) DEFAULT 'gasto' NOT NULL,
                moneda VARCHAR(10) DEFAULT 'ARS' NOT NULL
            );
        """)

        # 4. Tabla Pagos Recurrentes Log
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS pagos_recurrentes_log (
                id SERIAL PRIMARY KEY,
                recurrente_id INTEGER NOT NULL REFERENCES gastos_recurrentes(id) ON DELETE CASCADE,
                transaccion_id INTEGER REFERENCES transacciones(id) ON DELETE SET NULL,
                mes INTEGER NOT NULL,
                anio INTEGER NOT NULL
            );
        """)

        # 5. Tabla Planes Cuotas
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS planes_cuotas (
                id SERIAL PRIMARY KEY,
                descripcion TEXT NOT NULL,
                monto_total NUMERIC(15, 2) NOT NULL,
                monto_cuota NUMERIC(15, 2) NOT NULL,
                total_cuotas INTEGER NOT NULL,
                cuota_actual INTEGER DEFAULT 0 NOT NULL,
                fecha_inicio DATE NOT NULL,
                categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
                ultimo_pago_mes INTEGER,
                ultimo_pago_anio INTEGER,
                recurrente_id INTEGER REFERENCES gastos_recurrentes(id) ON DELETE SET NULL,
                moneda VARCHAR(10) DEFAULT 'ARS' NOT NULL
            );
        """)

        # 6. Tabla WebAuthn Credentials
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS webauthn_credentials (
                id SERIAL PRIMARY KEY,
                credential_id BYTEA UNIQUE NOT NULL,
                public_key BYTEA NOT NULL,
                sign_count BIGINT DEFAULT 0 NOT NULL
            );
        """)

        # Insertar algunas categorías básicas
        cursor.execute("""
            INSERT INTO categorias (nombre) 
            VALUES ('Sueldo'), ('Comida'), ('Servicios'), ('Transporte'), ('Ocio')
            ON CONFLICT (nombre) DO NOTHING;
        """)

        conn.commit()
        print("✅ ¡Tablas creadas exitosamente en la base de datos de desarrollo!")

    except psycopg2.Error as e:
        print(f"❌ Error conectando o creando tablas: {e}")
    finally:
        if 'conn' in locals() and conn:
            cursor.close()
            conn.close()

if __name__ == '__main__':
    init_dev_db()
