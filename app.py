import sqlite3
import os
import datetime
from flask import Flask, render_template, jsonify, request, g # type: ignore

# --- Configuración de la Aplicación Flask ---
app = Flask(__name__)
app.config['DATABASE'] = os.path.join(app.instance_path, 'gastos.db')

# --- Helper para la Base de Datos ---

def get_db():
    """Abre una nueva conexión a la BBDD si no existe una en el contexto actual."""
    if 'db' not in g:
        g.db = sqlite3.connect(
            app.config['DATABASE'],
            detect_types=sqlite3.PARSE_DECLTYPES
        )
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_db(e=None):
    """Cierra la conexión a la BBDD al final de la petición."""
    db = g.pop('db', None)
    if db is not None:
        db.close()

# --- Rutas Principales (Frontend y API) ---

@app.route('/')
def index():
    """Ruta principal que sirve el dashboard (el archivo HTML)."""
    return render_template('index.html')

@app.route('/api/test')
def api_test():
    """Una ruta de API de prueba para verificar que todo funciona."""
    return jsonify({ "mensaje": "¡Hola! bienvenido al sistema." })

# --- === RUTA DE API === ---

# --- === RUTA DE API PARA LEER CATEGORÍAS === ---
@app.route('/api/categorias')
def get_categorias():
    """
    Obtiene todas las categorías de la base de datos
    para rellenar los combos <select>.
    """
    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute("SELECT id, nombre FROM categorias ORDER BY nombre ASC")
        
        categorias = [dict(fila) for fila in cursor.fetchall()]
        
        return jsonify(categorias), 200
    except sqlite3.Error as e:
        return jsonify({ "error": f"Error de base de datos: {e}" }), 500
# --- === FIN RUTA === ---


# --- === RUTA 'AGREGAR' MODIFICADA === ---
@app.route('/api/transaccion', methods=['POST'])
def agregar_transaccion():
    """
    Ruta para agregar una nueva transacción (ingreso o gasto).
    Espera recibir 'categoria_id' en lugar de 'categoria'.
    """
    try:
        data = request.get_json()

        descripcion = data.get('descripcion')
        monto = data.get('monto')
        tipo = data.get('tipo')
        categoria_id = data.get('categoria_id') # <-- CAMBIO: Leemos el ID

        if not descripcion or not monto or not tipo:
            return jsonify({ "error": "Descripción, monto y tipo son obligatorios." }), 400

        monto_float = float(monto)
        fecha_hoy = datetime.date.today()

        # Convertir categoria_id a Int o Null
        categoria_id_int = None
        if categoria_id:
            try:
                # Nos aseguramos de que sea un número. Si envían "" o "null"
                # fallará el int() y se guardará como None (NULL), lo cual es correcto.
                categoria_id_int = int(categoria_id)
            except (ValueError, TypeError):
                categoria_id_int = None # Guardar como NULL si no es un ID válido

        db = get_db()
        cursor = db.cursor()
        cursor.execute(
            """
            INSERT INTO transacciones (descripcion, monto, tipo, fecha, categoria_id)
            VALUES (?, ?, ?, ?, ?)
            """, # <-- CAMBIO: Insertamos 'categoria_id'
            (descripcion, monto_float, tipo, fecha_hoy, categoria_id_int) # <-- CAMBIO
        )
        db.commit()

        return jsonify({ 
            "mensaje": "Transacción agregada exitosamente",
            "id": cursor.lastrowid
        }), 201

    except sqlite3.Error as e:
        return jsonify({ "error": f"Error de base de datos: {e}" }), 500
    except Exception as e:
        return jsonify({ "error": f"Error inesperado: {e}" }), 500
# --- === FIN RUTA 'AGREGAR' MODIFICADA === ---


# --- === RUTA 'LEER' MODIFICADA === ---
@app.route('/api/transacciones')
def get_transacciones():
    """
    Obtiene todas las transacciones, uniendo con categorías
    y FORMATEANDO la fecha a 'YYYY-MM-DD'.
    """
    try:
        db = get_db()
        cursor = db.cursor()
        
        # --- CAMBIO: Usamos strftime() en la consulta SQL ---
        cursor.execute(
            """
            SELECT 
                t.id, t.descripcion, t.monto, t.tipo, 
                strftime('%Y-%m-%d', t.fecha) AS fecha, -- <-- ¡CAMBIO AQUÍ!
                c.nombre AS categoria_nombre 
            FROM transacciones AS t
            LEFT JOIN categorias AS c ON t.categoria_id = c.id
            ORDER BY t.fecha DESC, t.id DESC
            """
        )
        # --- FIN DEL CAMBIO ---
        
        filas = cursor.fetchall()
        transacciones = [dict(fila) for fila in filas]
        
        return jsonify(transacciones), 200

    except sqlite3.Error as e:
        return jsonify({ "error": f"Error de base de datos: {e}" }), 500
    except Exception as e:
        return jsonify({ "error": f"Error inesperado: {e}" }), 500
# --- === FIN RUTA 'LEER' MODIFICADA === ---

# --- === API PARA GASTOS RECURRENTES === ---
@app.route('/api/recurrente', methods=['POST'])
def agregar_recurrente():
    """
    Define un nuevo gasto recurrente en la base de datos.
    """
    try:
        data = request.get_json()
        
        descripcion = data.get('descripcion')
        monto_estimado = data.get('monto_estimado')
        dia_vencimiento = data.get('dia_vencimiento')
        categoria_id = data.get('categoria_id')
        observacion = data.get('observacion') # <-- NUEVA LÍNEA

        # Validaciones
        if not all([descripcion, monto_estimado, dia_vencimiento, categoria_id]):
            return jsonify({ "error": "Todos los campos (excepto observación) son obligatorios." }), 400
        
        if not (1 <= int(dia_vencimiento) <= 31):
            return jsonify({ "error": "El día de vencimiento debe estar entre 1 y 31." }), 400

        db = get_db()
        cursor = db.cursor()
        
        cursor.execute(
            """
            INSERT INTO gastos_recurrentes (descripcion, monto_estimado, dia_vencimiento, categoria_id, observacion)
            VALUES (?, ?, ?, ?, ?)
            """, # <-- CAMBIO EN LA CONSULTA
            (descripcion, float(monto_estimado), int(dia_vencimiento), int(categoria_id), observacion) # <-- CAMBIO EN LOS DATOS
        )
        db.commit()
        
        return jsonify({ 
            "mensaje": "Gasto recurrente guardado exitosamente",
            "id": cursor.lastrowid
        }), 201

    except sqlite3.IntegrityError:
        return jsonify({ "error": "Error de integridad. ¿La categoría existe?" }), 400
    except Exception as e:
        return jsonify({ "error": f"Error inesperado: {e}" }), 500
# --- === FIN API GASTOS RECURRENTES === ---

# --- === API PARA ESTADO DE GASTOS RECURRENTES (Dashboard) === ---

@app.route('/api/recurrentes/status')
def get_recurrentes_status():
    """
    Obtiene TODOS los gastos recurrentes definidos y 
    comprueba su estado (Pendiente/Pagado) para el MES ACTUAL.
    """
    try:
        hoy = datetime.date.today()
        mes_actual = hoy.month
        anio_actual = hoy.year

        db = get_db()
        cursor = db.cursor()

        cursor.execute(
            """
            SELECT
                r.id,
                r.descripcion,
                r.monto_estimado,
                r.dia_vencimiento,
                r.observacion, -- <-- NUEVA LÍNEA
                c.nombre AS categoria_nombre,
                c.id AS categoria_id, -- <-- (Buena práctica añadir esto para editar)
                CASE 
                    WHEN l.id IS NOT NULL THEN 'Pagado'
                    ELSE 'Pendiente'
                END AS status,
                l.transaccion_id
            FROM gastos_recurrentes AS r
            JOIN categorias AS c ON r.categoria_id = c.id
            LEFT JOIN pagos_recurrentes_log AS l ON r.id = l.recurrente_id
                AND l.mes = ?
                AND l.anio = ?
            ORDER BY r.dia_vencimiento ASC
            """,
            (mes_actual, anio_actual)
        )
        
        recurrentes = [dict(fila) for fila in cursor.fetchall()]
        
        return jsonify(recurrentes), 200

    except sqlite3.Error as e:
        return jsonify({ "error": f"Error de base de datos: {e}" }), 500
# --- === FIN API ESTADO === ---


# --- === API PARA "PAGAR" UN GASTO RECURRENTE === ---
@app.route('/api/recurrente/pagar', methods=['POST'])
def pagar_recurrente():
    """
    Marca un gasto recurrente como pagado.
    Esto debe ser una TRANSACCIÓN:
    1. Crea el gasto en la tabla 'transacciones'.
    2. Crea el registro en la tabla 'pagos_recurrentes_log'.
    """
    try:
        data = request.get_json()
        recurrente_id = data.get('recurrente_id')
        monto_pagado = data.get('monto_pagado')

        if not recurrente_id or not monto_pagado:
            return jsonify({ "error": "Faltan datos (ID o monto)." }), 400

        hoy = datetime.date.today()
        mes_actual = hoy.month
        anio_actual = hoy.year
        
        db = get_db()
        cursor = db.cursor()

        # --- INICIO DE LA TRANSACCIÓN DE BASE DE DATOS ---
        # (Usamos 'with db:' que maneja el BEGIN/COMMIT/ROLLBACK)
        with db:
            # 1. Verificar que no esté ya pagado este mes
            cursor.execute(
                "SELECT id FROM pagos_recurrentes_log WHERE recurrente_id = ? AND mes = ? AND anio = ?",
                (recurrente_id, mes_actual, anio_actual)
            )
            if cursor.fetchone():
                return jsonify({ "error": "Este gasto ya fue pagado este mes." }), 400

            # 2. Obtener los datos del gasto recurrente (descripción, categoria_id)
            cursor.execute(
                "SELECT descripcion, categoria_id FROM gastos_recurrentes WHERE id = ?",
                (recurrente_id,)
            )
            gasto = cursor.fetchone()
            if not gasto:
                return jsonify({ "error": "No se encontró el gasto recurrente." }), 404

            # 3. Insertar el gasto en la tabla 'transacciones'
            desc_transaccion = f"Pago recurrente: {gasto['descripcion']}"
            cursor.execute(
                """
                INSERT INTO transacciones (descripcion, monto, tipo, fecha, categoria_id)
                VALUES (?, ?, 'gasto', ?, ?)
                """,
                (desc_transaccion, float(monto_pagado), hoy, gasto['categoria_id'])
            )
            
            # 4. Obtener el ID de la transacción que acabamos de crear
            nueva_transaccion_id = cursor.lastrowid

            # 5. Insertar el registro en el 'log' de pagos
            cursor.execute(
                """
                INSERT INTO pagos_recurrentes_log (recurrente_id, transaccion_id, mes, anio)
                VALUES (?, ?, ?, ?)
                """,
                (recurrente_id, nueva_transaccion_id, mes_actual, anio_actual)
            )
        
        # --- FIN DE LA TRANSACCIÓN (COMMIT automático si 'with' termina bien) ---

        return jsonify({ 
            "mensaje": "Gasto pagado y registrado exitosamente",
            "transaccion_id": nueva_transaccion_id
        }), 201

    except sqlite3.Error as e:
        return jsonify({ "error": f"Error de base de datos en la transacción: {e}" }), 500
    except Exception as e:
        return jsonify({ "error": f"Error inesperado: {e}" }), 500
# --- === FIN API PAGO === ---

# --- === API PARA EL DASHBOARD DE TOTALES === ---
@app.route('/api/dashboard/summary')
def get_dashboard_summary():
    """
    Calcula y devuelve los totales del mes actual:
    - Total Ingresos (transacciones)
    - Total Gastos (transacciones)
    - Total Pendiente (recurrentes no pagados)
    - Saldo Actual (Ingresos - Gastos)
    """
    try:
        hoy = datetime.date.today()
        mes_actual = hoy.month
        anio_actual = hoy.year
        
        # Formato de fecha para SQLite (YYYY-MM)
        mes_formato_db = f"{anio_actual:04d}-{mes_actual:02d}"

        db = get_db()
        cursor = db.cursor()

        # 1. Total Ingresos del mes
        cursor.execute(
            """
            SELECT COALESCE(SUM(monto), 0) AS total
            FROM transacciones
            WHERE tipo = 'ingreso' AND strftime('%Y-%m', fecha) = ?
            """,
            (mes_formato_db,)
        )
        total_ingresos = cursor.fetchone()['total']

        # 2. Total Gastos Pagados del mes
        cursor.execute(
            """
            SELECT COALESCE(SUM(monto), 0) AS total
            FROM transacciones
            WHERE tipo = 'gasto' AND strftime('%Y-%m', fecha) = ?
            """,
            (mes_formato_db,)
        )
        total_gastos = cursor.fetchone()['total']

        # 3. Total Pendiente de Pago
        # (Suma el monto estimado de recurrentes que NO están en el log de este mes)
        cursor.execute(
            """
            SELECT COALESCE(SUM(r.monto_estimado), 0) AS total
            FROM gastos_recurrentes AS r
            WHERE r.id NOT IN (
                SELECT l.recurrente_id
                FROM pagos_recurrentes_log AS l
                WHERE l.mes = ? AND l.anio = ?
            )
            """,
            (mes_actual, anio_actual)
        )
        total_pendiente = cursor.fetchone()['total']

        # 4. Saldo Actual
        saldo_actual = total_ingresos - total_gastos

        summary = {
            "total_ingresos": total_ingresos,
            "total_gastos": total_gastos,
            "total_pendiente": total_pendiente,
            "saldo_actual": saldo_actual
        }
        
        return jsonify(summary), 200

    except sqlite3.Error as e:
        return jsonify({ "error": f"Error de base de datos: {e}" }), 500
# --- === FIN API DASHBOARD === ---

# --- === API PARA PLANES DE CUOTAS === ---
@app.route('/api/cuota', methods=['POST'])
def agregar_plan_cuota():
    """
    Define un nuevo plan de cuotas (ej. una compra grande).
    """
    try:
        data = request.get_json()
        
        descripcion = data.get('descripcion')
        monto_total = data.get('monto_total')
        monto_cuota = data.get('monto_cuota')
        total_cuotas = data.get('total_cuotas')
        categoria_id = data.get('categoria_id')
        fecha_inicio = data.get('fecha_inicio') # Espera formato YYYY-MM-DD

        if not all([descripcion, monto_total, monto_cuota, total_cuotas, categoria_id, fecha_inicio]):
            return jsonify({ "error": "Todos los campos son obligatorios." }), 400

        # Validar la fecha
        try:
            fecha_obj = datetime.date.fromisoformat(fecha_inicio)
        except ValueError:
            return jsonify({ "error": "Formato de fecha de inicio inválido. Use YYYY-MM-DD." }), 400

        db = get_db()
        cursor = db.cursor()
        
        cursor.execute(
            """
            INSERT INTO planes_cuotas 
                (descripcion, monto_total, monto_cuota, total_cuotas, fecha_inicio, categoria_id, cuota_actual)
            VALUES (?, ?, ?, ?, ?, ?, 0)
            """,
            (descripcion, float(monto_total), float(monto_cuota), int(total_cuotas), fecha_obj, int(categoria_id))
        )
        db.commit()
        
        return jsonify({ 
            "mensaje": "Plan de cuotas guardado exitosamente",
            "id": cursor.lastrowid
        }), 201

    except Exception as e:
        return jsonify({ "error": f"Error inesperado: {e}" }), 500

@app.route('/api/cuotas/status')
def get_cuotas_status():
    """
    Obtiene todos los planes de cuotas ACTIVOS (cuota_actual < total_cuotas)
    y verifica si la cuota de este mes ya fue pagada.
    """
    try:
        hoy = datetime.date.today()
        mes_actual = hoy.month
        anio_actual = hoy.year

        db = get_db()
        cursor = db.cursor()

        cursor.execute(
            """
            SELECT
                p.id,
                p.descripcion,
                p.monto_cuota,
                p.cuota_actual,
                p.total_cuotas,
                p.monto_total, -- <-- AÑADIDO PARA EDITAR
                p.fecha_inicio, -- <-- AÑADIDO PARA EDITAR
                p.categoria_id, -- <-- AÑADIDO PARA EDITAR
                c.nombre AS categoria_nombre,
                CASE 
                    WHEN p.ultimo_pago_anio = ? AND p.ultimo_pago_mes = ? THEN 'Pagado este mes'
                    ELSE 'Pendiente este mes'
                END AS status_mes
            FROM planes_cuotas AS p
            JOIN categorias AS c ON p.categoria_id = c.id
            WHERE p.cuota_actual < p.total_cuotas
            ORDER BY p.id ASC
            """,
            (anio_actual, mes_actual)
        )
        
        cuotas = [dict(fila) for fila in cursor.fetchall()]
        
        return jsonify(cuotas), 200

    except sqlite3.Error as e:
        return jsonify({ "error": f"Error de base de datos: {e}" }), 500

@app.route('/api/cuota/pagar', methods=['POST'])
def pagar_cuota():
    """
    Registra el pago de una O MÁS cuotas.
    1. Recibe 'plan_id' y 'cantidad_cuotas'.
    2. Valida que se puedan pagar esa cantidad.
    3. Crea UN gasto en 'transacciones' por el monto TOTAL.
    4. Actualiza el plan (cuota_actual + cantidad, y fecha de último pago).
    """
    try:
        data = request.get_json()
        plan_id = data.get('plan_id')
        # Recibimos la cantidad de cuotas a pagar, por defecto es 1
        cantidad_a_pagar = data.get('cantidad_cuotas', 1)

        if not plan_id or not cantidad_a_pagar:
            return jsonify({ "error": "Faltan datos (ID o cantidad)." }), 400
        
        try:
            cantidad_a_pagar = int(cantidad_a_pagar)
            if cantidad_a_pagar <= 0:
                raise ValueError("La cantidad debe ser positiva")
        except (ValueError, TypeError):
             return jsonify({ "error": "Cantidad de cuotas inválida." }), 400

        hoy = datetime.date.today()
        mes_actual = hoy.month
        anio_actual = hoy.year
        
        db = get_db()
        cursor = db.cursor()

        with db: # Transacción
            # 1. Obtener datos del plan y verificar estado
            cursor.execute(
                "SELECT * FROM planes_cuotas WHERE id = ?", (plan_id,)
            )
            plan = cursor.fetchone()
            if not plan:
                return jsonify({ "error": "Plan no encontrado." }), 404
            
            # 2. Validaciones clave
            cuotas_restantes = plan['total_cuotas'] - plan['cuota_actual']
            if cuotas_restantes == 0:
                 return jsonify({ "error": "Este plan de cuotas ya está finalizado." }), 400
                 
            if cantidad_a_pagar > cuotas_restantes:
                return jsonify({ "error": f"No puedes pagar {cantidad_a_pagar} cuotas. Solo quedan {cuotas_restantes}." }), 400

            # (Opcional: Verificación de doble pago en el mes)
            if cantidad_a_pagar == 1 and (plan['ultimo_pago_anio'] == anio_actual and plan['ultimo_pago_mes'] == mes_actual):
                return jsonify({ "error": "La cuota de este mes ya fue pagada." }), 400

            # 3. Calcular montos y descripciones
            monto_total_pagado = plan['monto_cuota'] * cantidad_a_pagar
            cuota_inicial_str = plan['cuota_actual'] + 1
            cuota_final_str = plan['cuota_actual'] + cantidad_a_pagar
            
            desc_transaccion = f"Pago Cuota(s) ({cuota_inicial_str} a {cuota_final_str}/{plan['total_cuotas']}): {plan['descripcion']}"
            if cantidad_a_pagar == 1:
                 desc_transaccion = f"Pago Cuota ({cuota_inicial_str}/{plan['total_cuotas']}): {plan['descripcion']}"

            categoria_id = plan['categoria_id']
            
            # 4. Insertar el gasto ÚNICO en la tabla 'transacciones'
            cursor.execute(
                """
                INSERT INTO transacciones (descripcion, monto, tipo, fecha, categoria_id)
                VALUES (?, ?, 'gasto', ?, ?)
                """,
                (desc_transaccion, monto_total_pagado, hoy, categoria_id)
            )
            nueva_transaccion_id = cursor.lastrowid

            # 5. Actualizar el plan de cuotas
            cursor.execute(
                """
                UPDATE planes_cuotas
                SET 
                    cuota_actual = ?,
                    ultimo_pago_mes = ?,
                    ultimo_pago_anio = ?
                WHERE id = ?
                """,
                (plan['cuota_actual'] + cantidad_a_pagar, mes_actual, anio_actual, plan_id)
            )
        
        return jsonify({ 
            "mensaje": f"{cantidad_a_pagar} cuota(s) pagada(s) exitosamente por un total de {formatear_moneda_backend(monto_total_pagado)}",
            "transaccion_id": nueva_transaccion_id
        }), 201

    except sqlite3.Error as e:
        return jsonify({ "error": f"Error de base de datos: {e}" }), 500
    except Exception as e:
        return jsonify({ "error": f"Error inesperado: {e}" }), 500
# --- === FIN API CUOTAS === ---

# --- === RUTA: ELIMINAR Gasto Recurrente === ---
@app.route('/api/recurrente/<int:id>', methods=['DELETE'])
def eliminar_recurrente(id):
    """
    Elimina (finaliza) un gasto recurrente por su ID.
    También borra su historial de pagos en el log.
    """
    try:
        db = get_db()
        with db: # Transacción
            # Borrar primero los logs de pago asociados
            cursor = db.cursor()
            cursor.execute("DELETE FROM pagos_recurrentes_log WHERE recurrente_id = ?", (id,))
            
            # Borrar el gasto recurrente en sí
            cursor.execute("DELETE FROM gastos_recurrentes WHERE id = ?", (id,))
            
            # rowcount nos dice cuántas filas fueron afectadas
            if cursor.rowcount == 0:
                return jsonify({ "error": "Gasto recurrente no encontrado." }), 404
        
        return jsonify({ "mensaje": "Gasto recurrente eliminado exitosamente" }), 200

    except sqlite3.Error as e:
        # Si falla por una llave foránea (aunque ya borramos el log)
        if "FOREIGN KEY" in str(e):
            return jsonify({ "error": "Este gasto no se puede borrar, está en uso (esto es un error inesperado)." }), 409
        return jsonify({ "error": f"Error de base de datos: {e}" }), 500
    except Exception as e:
        return jsonify({ "error": f"Error inesperado: {e}" }), 500
# --- === FIN RUTA: ELIMINAR Gasto Recurrente === ---

# --- === RUTA: EDITAR Gasto Recurrente === ---
@app.route('/api/recurrente/<int:id>', methods=['PUT'])
def editar_recurrente(id):
    """
    Actualiza un gasto recurrente existente.
    """
    try:
        data = request.get_json()
        
        descripcion = data.get('descripcion')
        monto_estimado = data.get('monto_estimado')
        dia_vencimiento = data.get('dia_vencimiento')
        categoria_id = data.get('categoria_id')
        observacion = data.get('observacion') # <-- NUEVA LÍNEA

        if not all([descripcion, monto_estimado, dia_vencimiento, categoria_id]):
            return jsonify({ "error": "Todos los campos (excepto observación) son obligatorios." }), 400
        
        db = get_db()
        with db:
            cursor = db.cursor()
            cursor.execute(
                """
                UPDATE gastos_recurrentes
                SET 
                    descripcion = ?,
                    monto_estimado = ?,
                    dia_vencimiento = ?,
                    categoria_id = ?,
                    observacion = ? 
                WHERE id = ?
                """, # <-- CAMBIO EN LA CONSULTA
                (descripcion, float(monto_estimado), int(dia_vencimiento), int(categoria_id), observacion, id) # <-- CAMBIO EN LOS DATOS
            )
            if cursor.rowcount == 0:
                return jsonify({ "error": "Gasto recurrente no encontrado para actualizar." }), 404
        
        return jsonify({ "mensaje": "Gasto recurrente actualizado exitosamente" }), 200

    except Exception as e:
        return jsonify({ "error": f"Error inesperado: {e}" }), 500
# --- === FIN RUTA: EDITAR Gasto Recurrente === ---

# --- === RUTA: ELIMINAR Plan de Cuotas === ---
@app.route('/api/cuota/<int:id>', methods=['DELETE'])
def eliminar_plan_cuota(id):
    """
    Elimina un plan de cuotas por su ID.
    PRECAUCIÓN: Esto no borra las transacciones de cuotas YA PAGADAS.
    """
    try:
        db = get_db()
        with db:
            cursor = db.cursor()
            cursor.execute("DELETE FROM planes_cuotas WHERE id = ?", (id,))
            
            if cursor.rowcount == 0:
                return jsonify({ "error": "Plan de cuotas no encontrado." }), 404
        
        return jsonify({ "mensaje": "Plan de cuotas eliminado exitosamente" }), 200

    except sqlite3.Error as e:
        # Si falla por una llave foránea (ej. si una tabla futura depende de esta)
        if "FOREIGN KEY" in str(e):
            return jsonify({ "error": "Este plan no se puede borrar, está en uso." }), 409
        return jsonify({ "error": f"Error de base de datos: {e}" }), 500
    except Exception as e:
        return jsonify({ "error": f"Error inesperado: {e}" }), 500
# --- === FIN RUTA: ELIMINAR Plan de Cuotas === ---


# --- === RUTA: EDITAR Plan de Cuotas === ---
@app.route('/api/cuota/<int:id>', methods=['PUT'])
def editar_plan_cuota(id):
    """
    Actualiza un plan de cuotas existente.
    NOTA: No permitimos editar 'cuota_actual' desde aquí.
    """
    try:
        data = request.get_json()
        
        # Obtenemos todos los datos del formulario
        descripcion = data.get('descripcion')
        monto_total = data.get('monto_total')
        monto_cuota = data.get('monto_cuota')
        total_cuotas = data.get('total_cuotas')
        categoria_id = data.get('categoria_id')
        fecha_inicio = data.get('fecha_inicio')

        if not all([descripcion, monto_total, monto_cuota, total_cuotas, categoria_id, fecha_inicio]):
            return jsonify({ "error": "Todos los campos son obligatorios." }), 400

        # Validar la fecha
        try:
            fecha_obj = datetime.date.fromisoformat(fecha_inicio)
        except ValueError:
            return jsonify({ "error": "Formato de fecha de inicio inválido. Use YYYY-MM-DD." }), 400

        db = get_db()
        with db:
            cursor = db.cursor()
            cursor.execute(
                """
                UPDATE planes_cuotas
                SET 
                    descripcion = ?,
                    monto_total = ?,
                    monto_cuota = ?,
                    total_cuotas = ?,
                    categoria_id = ?,
                    fecha_inicio = ?
                WHERE id = ?
                """,
                (descripcion, float(monto_total), float(monto_cuota), int(total_cuotas), int(categoria_id), fecha_obj, id)
            )
            if cursor.rowcount == 0:
                return jsonify({ "error": "Plan de cuotas no encontrado para actualizar." }), 404
        
        return jsonify({ "mensaje": "Plan de cuotas actualizado exitosamente" }), 200

    except Exception as e:
        return jsonify({ "error": f"Error inesperado: {e}" }), 500
# --- === FIN RUTA: EDITAR Plan de Cuotas === ---

# (Helper para el mensaje de éxito)
def formatear_moneda_backend(numero):
    """Función helper para formatear moneda en el backend"""
    return "${:,.2f}".format(numero).replace(",", "X").replace(".", ",").replace("X", ".")

# --- Iniciar el Servidor ---
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)