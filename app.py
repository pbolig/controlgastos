import sqlite3
import os
import datetime
from functools import wraps
from flask import Flask, render_template, jsonify, request, g, session, redirect, url_for

# --- Configuración de la Aplicación Flask ---
app = Flask(__name__)
app.config['DATABASE'] = os.path.join(app.instance_path, 'gastos.db')

# --- VERSIÓN DE LA APP ---
APP_VERSION = "v1.2.0"

# --- SEGURIDAD ---
app.secret_key = 'mi_clave_secreta_desarrollo_local'
PASSWORD_MAESTRA = "Juani2008**"

# --- Decorador @login_required ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Si no hay marca de 'logged_in' en la sesión...
        if 'logged_in' not in session:
            # Si intentan acceder a una API, devolvemos error 401
            if request.path.startswith('/api/'):
                return jsonify({"error": "No autorizado"}), 401
            # Si es el navegador, redirigimos al login
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# --- Helper para la Base de Datos ---
def get_db():
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

# --- RUTAS DE AUTENTICACIÓN ---

@app.route('/login', methods=['GET', 'POST'])
def login():
    # NOTA: Esta ruta NO debe tener @login_required
    error = None
    if request.method == 'POST':
        password_ingresada = request.form['password']
        if password_ingresada == PASSWORD_MAESTRA:
            session['logged_in'] = True
            return redirect(url_for('index'))
        else:
            error = 'Contraseña incorrecta. Inténtalo de nuevo.'
    return render_template('login.html', error=error)

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('login'))

# --- Rutas Principales (Frontend y API) ---

@app.route('/')
@login_required
def index():
    """Ruta principal que sirve el dashboard (el archivo HTML)."""
    return render_template('index.html', version=APP_VERSION)

@app.route('/api/test')
@login_required
def api_test():
    return jsonify({ "mensaje": "¡Hola! bienvenido al sistema." })

# --- === API DE CATEGORÍAS === ---
@app.route('/api/categorias')
@login_required
def get_categorias():
    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute("SELECT id, nombre FROM categorias ORDER BY nombre ASC")
        categorias = [dict(fila) for fila in cursor.fetchall()]
        return jsonify(categorias), 200
    except sqlite3.Error as e:
        return jsonify({ "error": f"Error de base de datos: {e}" }), 500

# --- === API DE TRANSACCIONES === ---
@app.route('/api/transaccion', methods=['POST'])
@login_required
def agregar_transaccion():
    try:
        data = request.get_json()
        descripcion = data.get('descripcion')
        monto = data.get('monto')
        tipo = data.get('tipo')
        categoria_id = data.get('categoria_id')
        # Leemos la moneda, con 'ARS' como valor por defecto
        moneda = data.get('moneda', 'ARS')

        if not descripcion or not monto or not tipo:
            return jsonify({ "error": "Descripción, monto y tipo son obligatorios." }), 400

        monto_float = float(monto)
        fecha_hoy = datetime.date.today()
        categoria_id_int = int(categoria_id) if categoria_id else None

        db = get_db()
        cursor = db.cursor()
        cursor.execute(
            "INSERT INTO transacciones (descripcion, monto, tipo, fecha, categoria_id, moneda) VALUES (?, ?, ?, ?, ?, ?)",
            (descripcion, monto_float, tipo, fecha_hoy, categoria_id_int, moneda)
        )
        db.commit()
        return jsonify({ "mensaje": "Transacción agregada exitosamente", "id": cursor.lastrowid }), 201
    except Exception as e:
        return jsonify({ "error": f"Error inesperado: {e}" }), 500

@app.route('/api/transacciones')
@login_required
def get_transacciones():
    try:
        db = get_db()
        cursor = db.cursor()
        # Formateamos fecha a YYYY-MM-DD para el frontend
        cursor.execute("""
            SELECT t.id, t.descripcion, t.monto, t.tipo, t.moneda, strftime('%Y-%m-%d', t.fecha) AS fecha, c.nombre AS categoria_nombre 
            FROM transacciones AS t 
            LEFT JOIN categorias AS c ON t.categoria_id = c.id
            ORDER BY t.fecha DESC, t.id DESC
        """)
        transacciones = [dict(fila) for fila in cursor.fetchall()]
        return jsonify(transacciones), 200
    except Exception as e:
        return jsonify({ "error": f"Error inesperado: {e}" }), 500

# --- === API DE RECURRENTES === ---
@app.route('/api/recurrente', methods=['POST'])
@login_required
def agregar_recurrente():
    try:
        data = request.get_json()
        # Por defecto es 'gasto' si no se especifica
        tipo = data.get('tipo', 'gasto') 
        moneda = data.get('moneda', 'ARS')
        
        if not all([data.get('descripcion'), data.get('monto_estimado'), data.get('dia_vencimiento'), data.get('categoria_id')]):
            return jsonify({ "error": "Faltan campos obligatorios." }), 400
        
        db = get_db()
        cursor = db.cursor()
        cursor.execute(
            "INSERT INTO gastos_recurrentes (descripcion, monto_estimado, dia_vencimiento, categoria_id, observacion, tipo, moneda) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (data['descripcion'], float(data['monto_estimado']), int(data['dia_vencimiento']), int(data['categoria_id']), data.get('observacion'), tipo, moneda)
        )
        db.commit()
        return jsonify({ "mensaje": "Movimiento recurrente guardado", "id": cursor.lastrowid }), 201
    except Exception as e:
        return jsonify({ "error": f"Error: {e}" }), 500

@app.route('/api/recurrente/<int:id>', methods=['DELETE'])
@login_required
def eliminar_recurrente(id):
    try:
        db = get_db()
        with db:
            # Primero borramos el historial de pagos de este recurrente
            db.execute("DELETE FROM pagos_recurrentes_log WHERE recurrente_id=?", (id,))
            # Luego borramos el recurrente en sí
            cursor = db.execute("DELETE FROM gastos_recurrentes WHERE id=?", (id,))
            
            if cursor.rowcount == 0:
                return jsonify({ "error": "No encontrado" }), 404
                
        return jsonify({ "mensaje": "Eliminado correctamente" }), 200
    except Exception as e: 
        return jsonify({ "error": str(e) }), 500
    
@app.route('/api/recurrente/<int:id>', methods=['PUT'])
@login_required
def editar_recurrente(id):
    try:
        d = request.get_json()
        tipo = d.get('tipo', 'gasto')
        moneda = d.get('moneda', 'ARS')
        db = get_db()
        cursor = db.cursor()
        cursor.execute(
            "UPDATE gastos_recurrentes SET descripcion=?, monto_estimado=?, dia_vencimiento=?, categoria_id=?, observacion=?, tipo=?, moneda=? WHERE id=?",
            (d['descripcion'], float(d['monto_estimado']), int(d['dia_vencimiento']), int(d['categoria_id']), d.get('observacion'), tipo, moneda, id)
        )
        db.commit()
        return jsonify({ "mensaje": "Actualizado correctamente" }), 200
    except Exception as e: 
        return jsonify({ "error": str(e) }), 500

@app.route('/api/recurrentes/status')
@login_required
def get_recurrentes_status():
    try:
        hoy = datetime.date.today()
        db = get_db()
        cursor = db.cursor()
        cursor.execute("""
            SELECT r.id, r.descripcion, r.monto_estimado, r.dia_vencimiento, r.observacion, r.tipo, r.moneda,
            c.nombre AS categoria_nombre, c.id AS categoria_id,
            CASE 
                WHEN l.id IS NOT NULL AND l.transaccion_id IS NULL THEN 'Omitido' -- Nueva lógica
                WHEN l.id IS NOT NULL THEN 'Procesado' 
                ELSE 'Pendiente' 
            END AS status
            FROM gastos_recurrentes AS r 
            JOIN categorias AS c ON r.categoria_id = c.id
            LEFT JOIN pagos_recurrentes_log AS l ON r.id = l.recurrente_id AND l.mes = ? AND l.anio = ?
            ORDER BY r.dia_vencimiento ASC
        """, (hoy.month, hoy.year))
        return jsonify([dict(fila) for fila in cursor.fetchall()]), 200
    except Exception as e: return jsonify({ "error": f"Error: {e}" }), 500
    
@app.route('/api/recurrente/omitir', methods=['POST'])
@login_required
def omitir_recurrente():
    """Marca un recurrente como 'Saltado' este mes (sin movimiento de dinero)"""
    try:
        data = request.get_json()
        recurrente_id = data.get('recurrente_id')
        hoy = datetime.date.today()
        
        db = get_db()
        cursor = db.cursor()
        with db:
            # Insertamos en el log pero con transaccion_id NULL (o None en Python)
            cursor.execute(
                "INSERT INTO pagos_recurrentes_log (recurrente_id, transaccion_id, mes, anio) VALUES (?, ?, ?, ?)",
                (recurrente_id, None, hoy.month, hoy.year)
            )
        return jsonify({ "mensaje": "Gasto omitido por este mes." }), 201
    except Exception as e: return jsonify({ "error": str(e) }), 500
    
@app.route('/api/recurrente/historial/<int:id>', methods=['GET'])
@login_required
def historial_recurrente(id):
    """Devuelve los últimos 6 pagos reales de este recurrente"""
    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute("""
            SELECT t.fecha, t.monto, t.descripcion
            FROM pagos_recurrentes_log l
            JOIN transacciones t ON l.transaccion_id = t.id
            WHERE l.recurrente_id = ?
            ORDER BY t.fecha DESC
            LIMIT 6
        """, (id,))
        historial = [dict(f) for f in cursor.fetchall()]
        # Formateamos fecha para el frontend
        for h in historial:
            # Convertir objeto date a string si es necesario, o formatear string
            if isinstance(h['fecha'], str): # Si viene como string YYYY-MM-DD
                parts = h['fecha'].split('-')
                h['fecha'] = f"{parts[2]}/{parts[1]}/{parts[0]}"
        
        return jsonify(historial), 200
    except Exception as e: return jsonify({ "error": str(e) }), 500

@app.route('/api/recurrente/pagar', methods=['POST'])
@login_required
def pagar_recurrente():
    try:
        data = request.get_json()
        hoy = datetime.date.today()
        db = get_db()
        cursor = db.cursor()
        with db:
            cursor.execute("SELECT * FROM gastos_recurrentes WHERE id=?", (data['recurrente_id'],))
            recurrente = cursor.fetchone()
            
            # Usamos el tipo del recurrente (ingreso o gasto)
            tipo_movimiento = recurrente['tipo'] 
            
            # Texto dinámico según el tipo
            accion_txt = "Cobro" if tipo_movimiento == 'ingreso' else "Pago"
            desc = f"{accion_txt} recurrente: {recurrente['descripcion']}"
            
            # Insertamos usando el 'tipo_movimiento' correcto (esto arregla la resta/suma)
            cursor.execute("INSERT INTO transacciones (descripcion, monto, tipo, fecha, categoria_id, moneda) VALUES (?, ?, ?, ?, ?, ?)",
                           (desc, float(data['monto_pagado']), tipo_movimiento, hoy, recurrente['categoria_id'], recurrente['moneda']))
            
            new_id = cursor.lastrowid
            cursor.execute("INSERT INTO pagos_recurrentes_log (recurrente_id, transaccion_id, mes, anio) VALUES (?, ?, ?, ?)",
                           (data['recurrente_id'], new_id, hoy.month, hoy.year))
        return jsonify({ "mensaje": "Procesado exitosamente" }), 201
    except Exception as e: return jsonify({ "error": f"Error: {e}" }), 500

# --- === API DASHBOARD === ---
@app.route('/api/dashboard/summary')
@login_required
def get_dashboard_summary():
    try:
        hoy = datetime.date.today()
        mes_formato = f"{hoy.year:04d}-{hoy.month:02d}"
        db = get_db()
        
        # Preparamos la estructura de respuesta
        summary = {
            'ARS': {'ingresos': 0, 'gastos': 0, 'pendiente': 0, 'saldo': 0},
            'USD': {'ingresos': 0, 'gastos': 0, 'pendiente': 0, 'saldo': 0}
        }

        # Calculamos para cada moneda
        for moneda in ['ARS', 'USD']:
            cursor = db.cursor()
            
            # Ingresos y Gastos del mes
            cursor.execute("SELECT tipo, COALESCE(SUM(monto), 0) as total FROM transacciones WHERE strftime('%Y-%m', fecha)=? AND moneda=? GROUP BY tipo", (mes_formato, moneda))
            for row in cursor.fetchall():
                if row['tipo'] == 'ingreso':
                    summary[moneda]['ingresos'] = row['total']
                elif row['tipo'] == 'gasto':
                    summary[moneda]['gastos'] = row['total']
            
            # Pendientes del mes
            cursor.execute("""
                SELECT COALESCE(SUM(r.monto_estimado), 0) as total FROM gastos_recurrentes AS r 
                WHERE r.moneda=? AND r.id NOT IN (SELECT recurrente_id FROM pagos_recurrentes_log WHERE mes=? AND anio=?)
            """, (moneda, hoy.month, hoy.year))
            summary[moneda]['pendiente'] = cursor.fetchone()['total']
            
            # Saldo
            summary[moneda]['saldo'] = summary[moneda]['ingresos'] - summary[moneda]['gastos']

        return jsonify(summary), 200
    except Exception as e: return jsonify({ "error": f"Error: {e}" }), 500

# --- === API DE CUOTAS === ---
@app.route('/api/cuota', methods=['POST'])
@login_required
def agregar_plan_cuota():
    try:
        d = request.get_json()
        f = datetime.date.fromisoformat(d['fecha_inicio'])
        # Capturamos el ID de la tarjeta (puede venir vacío)
        rec_id = int(d['recurrente_id']) if d.get('recurrente_id') else None 
        moneda = d.get('moneda', 'ARS')
        
        db = get_db()
        cursor = db.cursor()
        cursor.execute(
            "INSERT INTO planes_cuotas (descripcion, monto_total, monto_cuota, total_cuotas, fecha_inicio, categoria_id, recurrente_id, cuota_actual, moneda) VALUES (?,?,?,?,?,?,?,0,?)",
            (d['descripcion'], float(d['monto_total']), float(d['monto_cuota']), int(d['total_cuotas']), f, int(d['categoria_id']), rec_id, moneda)
        )
        db.commit()
        return jsonify({ "mensaje": "Plan guardado" }), 201
    except Exception as e: return jsonify({ "error": str(e) }), 500

@app.route('/api/cuotas/status')
@login_required
def get_cuotas_status():
    try:
        hoy = datetime.date.today()
        db = get_db()
        cursor = db.cursor()
        # Agregamos p.recurrente_id a la consulta
        cursor.execute("""
            SELECT p.*, c.nombre AS categoria_nombre,
            CASE WHEN p.ultimo_pago_anio = ? AND p.ultimo_pago_mes = ? THEN 'Pagado este mes' ELSE 'Pendiente este mes' END as status_mes
            FROM planes_cuotas p JOIN categorias c ON p.categoria_id = c.id
            WHERE p.cuota_actual < p.total_cuotas ORDER BY p.id ASC
        """, (hoy.year, hoy.month))
        return jsonify([dict(f) for f in cursor.fetchall()]), 200
    except Exception as e: return jsonify({ "error": str(e) }), 500

@app.route('/api/cuota/pagar', methods=['POST'])
@login_required
def pagar_cuota():
    try:
        data = request.get_json()
        cant = int(data.get('cantidad_cuotas', 1))
        hoy = datetime.date.today()
        db = get_db()
        cursor = db.cursor()
        with db:
            cursor.execute("SELECT * FROM planes_cuotas WHERE id=?", (data['plan_id'],))
            plan = cursor.fetchone()
            
            restantes = plan['total_cuotas'] - plan['cuota_actual']
            if cant > restantes:
                return jsonify({ "error": f"No puedes pagar {cant}, solo quedan {restantes}." }), 400

            monto_total = plan['monto_cuota'] * cant
            desc = f"Pago Cuota(s) ({plan['cuota_actual']+1} a {plan['cuota_actual']+cant}/{plan['total_cuotas']}): {plan['descripcion']}"
            if cant == 1: desc = f"Pago Cuota ({plan['cuota_actual']+1}/{plan['total_cuotas']}): {plan['descripcion']}"
            
            cursor.execute("INSERT INTO transacciones (descripcion, monto, tipo, fecha, categoria_id, moneda) VALUES (?, ?, 'gasto', ?, ?, ?)",
                           (desc, monto_total, hoy, plan['categoria_id'], plan['moneda']))
            new_id = cursor.lastrowid
            cursor.execute("UPDATE planes_cuotas SET cuota_actual=?, ultimo_pago_mes=?, ultimo_pago_anio=? WHERE id=?",
                           (plan['cuota_actual']+cant, hoy.month, hoy.year, plan['id']))
        return jsonify({ "mensaje": f"Pagado exitosamente", "transaccion_id": new_id }), 201
    except Exception as e: return jsonify({ "error": f"Error: {e}" }), 500

@app.route('/api/cuota/<int:id>', methods=['DELETE'])
@login_required
def eliminar_cuota(id):
    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute("DELETE FROM planes_cuotas WHERE id=?", (id,))
        db.commit()
        return jsonify({ "mensaje": "Eliminado" }), 200
    except Exception as e: return jsonify({ "error": f"Error: {e}" }), 500

@app.route('/api/cuota/<int:id>', methods=['PUT'])
@login_required
def editar_plan_cuota(id):
    try:
        d = request.get_json()
        f = datetime.date.fromisoformat(d['fecha_inicio'])
        rec_id = int(d['recurrente_id']) if d.get('recurrente_id') else None 
        moneda = d.get('moneda', 'ARS')

        db = get_db()
        db.execute(
            "UPDATE planes_cuotas SET descripcion=?, monto_total=?, monto_cuota=?, total_cuotas=?, categoria_id=?, fecha_inicio=?, recurrente_id=?, moneda=? WHERE id=?",
            (d['descripcion'], float(d['monto_total']), float(d['monto_cuota']), int(d['total_cuotas']), int(d['categoria_id']), f, rec_id, moneda, id)
        )
        db.commit()
        return jsonify({ "mensaje": "Actualizado" }), 200
    except Exception as e: return jsonify({ "error": str(e) }), 500
    
@app.route('/reportes')
@login_required
def reportes():
    return render_template('reportes.html', version=APP_VERSION)

@app.route('/api/reportes/filtrar', methods=['POST'])
@login_required
def filtrar_reportes():
    try:
        data = request.get_json()
        # ¡AQUÍ ESTABA EL ERROR! Ahora usamos strftime para que el JS reciba la fecha limpia
        query = """
            SELECT t.id, t.descripcion, t.monto, t.tipo, t.moneda, strftime('%Y-%m-%d', t.fecha) as fecha, c.nombre AS categoria_nombre
            FROM transacciones t
            LEFT JOIN categorias c ON t.categoria_id = c.id
            WHERE 1=1
        """
        params = []

        if data.get('fecha_desde'):
            query += " AND t.fecha >= ?"
            params.append(data['fecha_desde'])
        
        if data.get('fecha_hasta'):
            query += " AND t.fecha <= ?"
            params.append(data['fecha_hasta'])
            
        if data.get('tipo') and data['tipo'] != 'todos':
            query += " AND t.tipo = ?"
            params.append(data['tipo'])

        if data.get('categoria_id'):
            query += " AND t.categoria_id = ?"
            params.append(int(data['categoria_id']))
            
        if data.get('moneda') and data['moneda'] != 'todas':
            query += " AND t.moneda = ?"
            params.append(data['moneda'])

        query += " ORDER BY t.fecha DESC"

        db = get_db()
        cursor = db.cursor()
        cursor.execute(query, params)
        
        return jsonify([dict(f) for f in cursor.fetchall()]), 200

    except Exception as e:
        return jsonify({ "error": str(e) }), 500
    
# --- API: PAGO DE TARJETA ---
@app.route('/api/tarjeta/pagar-resumen', methods=['POST'])
@login_required
def pagar_resumen_tarjeta():
    try:
        data = request.get_json()
        recurrente_id = data.get('recurrente_id')
        ids_cuotas = data.get('planes_ids', []) # Lista de IDs de planes a avanzar
        monto_otros = float(data.get('monto_otros', 0))
        monto_total = float(data.get('monto_total', 0))
        moneda_pago = data.get('moneda') # Moneda del resumen que se está pagando (ARS o USD)

        hoy = datetime.date.today()
        db = get_db()
        cursor = db.cursor()

        with db:
            # 1. Obtener info del recurrente (La tarjeta en sí)
            cursor.execute("SELECT * FROM gastos_recurrentes WHERE id=?", (recurrente_id,))
            tarjeta = cursor.fetchone()
            if not tarjeta: return jsonify({"error": "Tarjeta no encontrada"}), 404
            
            if not moneda_pago: return jsonify({"error": "La moneda de pago es obligatoria."}), 400

            # 2. Procesar los planes de cuotas seleccionados
            nombres_planes = []
            for plan_id in ids_cuotas:
                # Avanzamos 1 cuota a cada plan
                cursor.execute("SELECT * FROM planes_cuotas WHERE id=?", (plan_id,))
                plan = cursor.fetchone()
                if plan:
                    # Solo agregamos el nombre si la cuota coincide con la moneda que estamos pagando
                    if plan['moneda'] != moneda_pago: continue
                    nombres_planes.append(plan['descripcion'])
                    cursor.execute(
                        "UPDATE planes_cuotas SET cuota_actual = cuota_actual + 1, ultimo_pago_mes=?, ultimo_pago_anio=? WHERE id=?",
                        (hoy.month, hoy.year, plan_id)
                    )

            # 3. Crear la descripción de la transacción
            detalles = ", ".join(nombres_planes)
            desc = f"Resumen {tarjeta['descripcion']} ({moneda_pago})"
            if detalles:
                desc += f" (Cuotas: {detalles})"
            if monto_otros > 0:
                desc += f" + Consumos varios ({moneda_pago})"

            # 4. Insertar la transacción ÚNICA por el total
            cursor.execute(
                "INSERT INTO transacciones (descripcion, monto, tipo, fecha, categoria_id, moneda) VALUES (?, ?, 'gasto', ?, ?, ?)",
                (desc, monto_total, hoy, tarjeta['categoria_id'], moneda_pago)
            )
            transaccion_id = cursor.lastrowid

            # 5. Marcar el recurrente como pagado este mes
            cursor.execute(
                "INSERT INTO pagos_recurrentes_log (recurrente_id, transaccion_id, mes, anio) VALUES (?, ?, ?, ?)",
                (recurrente_id, transaccion_id, hoy.month, hoy.year)
            )

        return jsonify({ "mensaje": "Resumen de tarjeta pagado y cuotas actualizadas." }), 201

    except Exception as e:
        return jsonify({ "error": str(e) }), 500

# --- INICIO SERVIDOR ---
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)