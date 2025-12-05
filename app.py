import sqlite3
import os
from datetime import date, datetime, timedelta
from functools import wraps
from flask import Flask, render_template, jsonify, request, g, session, redirect, url_for, send_from_directory
import uuid
from webauthn import generate_registration_options, verify_registration_response, generate_authentication_options, verify_authentication_response, base64url_to_bytes
from werkzeug.utils import secure_filename

# --- Configuración de la Aplicación Flask ---
app = Flask(__name__)
app.config['DATABASE'] = os.path.join(app.instance_path, 'gastos.db')

# --- Configuración para Subida de Archivos ---
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
# Nos aseguramos de que la carpeta de subidas exista.
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)


# --- VERSIÓN DE LA APP ---
APP_VERSION = "v2.0.0"

# --- SEGURIDAD ---
app.secret_key = 'mi_clave_secreta_desarrollo_local'
# Leemos la contraseña desde una variable de entorno para más seguridad
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(minutes=30) # <-- Tiempo de vida de la sesión
PASSWORD_MAESTRA = os.environ.get("PASSWORD_MAESTRA", "Juani2008**")

# --- Configuración de WebAuthn ---
# Leemos la configuración de WebAuthn desde variables de entorno para que sea flexible
# entre desarrollo y producción.
RP_ID = os.environ.get("WEBAUTHN_RP_ID", "localhost")
RP_NAME = "Control de Gastos"
ORIGIN = os.environ.get("WEBAUTHN_ORIGIN", "http://localhost:5000")

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

@app.before_request
def before_request_func():
    """Refresca el tiempo de la sesión en cada petición."""
    session.permanent = True
    session.modified = True

# --- RUTAS DE AUTENTICACIÓN ---

@app.route('/login', methods=['GET', 'POST'])
def login():
    # NOTA: Esta ruta NO debe tener @login_required
    error = None
    if request.method == 'POST':
        password_ingresada = request.form['password']
        if password_ingresada == PASSWORD_MAESTRA: # Usamos la variable
            session.permanent = True # Hacemos la sesión permanente
            session['logged_in'] = True
            return redirect(url_for('index'))
        else:
            error = 'Contraseña incorrecta. Inténtalo de nuevo.'
    return render_template('login.html', error=error)

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('login'))

# --- Helper para guardar comprobantes ---
def guardar_comprobante(file_storage):
    """
    Guarda un archivo de comprobante en una carpeta anual y devuelve la ruta relativa.
    Retorna None si no hay archivo o si ocurre un error.
    """
    if not file_storage or file_storage.filename == '':
        return None

    try:
        # 1. Crear la carpeta del año actual (ej: 'uploads/2024')
        current_year = str(datetime.now().year)
        year_folder = os.path.join(app.config['UPLOAD_FOLDER'], current_year)
        os.makedirs(year_folder, exist_ok=True)

        # 2. Generar un nombre de archivo seguro y único
        original_filename = secure_filename(file_storage.filename)
        extension = os.path.splitext(original_filename)[1]
        unique_filename = f"{uuid.uuid4().hex}{extension}"
        
        # 3. Guardar el archivo
        save_path = os.path.join(year_folder, unique_filename)
        file_storage.save(save_path)
        
        # 4. Devolver la ruta relativa para la base de datos (ej: '2024/nombre_unico.pdf')
        return os.path.join(current_year, unique_filename).replace('\\', '/')
    except Exception as e:
        print(f"Error al guardar el archivo: {e}")
        return None

# --- Rutas Principales (Frontend y API) ---

@app.route('/')
@login_required
def index():
    """Ruta principal que sirve el dashboard (el archivo HTML)."""
    return render_template('index.html', version=APP_VERSION, webauthn_enabled=True)

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

@app.route('/api/categoria', methods=['POST'])
@login_required
def agregar_categoria():
    try:
        data = request.get_json()
        nombre = data.get('nombre')
        if not nombre or not nombre.strip():
            return jsonify({"error": "El nombre de la categoría no puede estar vacío."}), 400
        
        db = get_db()
        cursor = db.cursor()
        cursor.execute("INSERT INTO categorias (nombre) VALUES (?)", (nombre.strip(),))
        db.commit()
        
        new_id = cursor.lastrowid
        return jsonify({"mensaje": "Categoría creada exitosamente", "id": new_id, "nombre": nombre.strip()}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Esa categoría ya existe."}), 409
    except Exception as e: return jsonify({"error": str(e)}), 500

# --- === API DE TRANSACCIONES === ---
@app.route('/api/transaccion', methods=['POST'])
@login_required
def agregar_transaccion():
    try:
        # Cambiamos a request.form para recibir datos de formulario con archivos
        datos = request.form
        descripcion = datos.get('descripcion')
        monto = datos.get('monto')
        tipo = datos.get('tipo')
        categoria_id = datos.get('categoria_id')
        # Leemos la moneda, con 'ARS' como valor por defecto
        moneda = datos.get('moneda', 'ARS')
        comprobante_file = request.files.get('comprobante')

        if not descripcion or not monto or not tipo:
            return jsonify({ "error": "Descripción, monto y tipo son obligatorios." }), 400

        comprobante_path = guardar_comprobante(comprobante_file)
        monto_float = float(monto)
        fecha_hoy = date.today()
        categoria_id_int = int(categoria_id) if categoria_id else None

        db = get_db()
        cursor = db.cursor()
        cursor.execute(
            "INSERT INTO transacciones (descripcion, monto, tipo, fecha, categoria_id, moneda, comprobante_path) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (descripcion, monto_float, tipo, fecha_hoy, categoria_id_int, moneda, comprobante_path)
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
        # Añadimos la columna comprobante_path a la consulta
        cursor.execute("""
            SELECT t.id, t.descripcion, t.monto, t.tipo, t.moneda, strftime('%Y-%m-%d', t.fecha) AS fecha, c.nombre AS categoria_nombre, t.comprobante_path
            FROM transacciones AS t 
            LEFT JOIN categorias AS c ON t.categoria_id = c.id
            ORDER BY t.fecha DESC, t.id DESC
        """)
        transacciones = [dict(fila) for fila in cursor.fetchall()]
        return jsonify(transacciones), 200
    except Exception as e:
        return jsonify({ "error": f"Error inesperado: {e}" }), 500

@app.route('/api/transaccion/<int:id>', methods=['DELETE'])
@login_required
def eliminar_transaccion(id):
    try:
        db = get_db()
        cursor = db.cursor()

        # Medida de seguridad: Verificar si la transacción está vinculada a un pago recurrente.
        # Si lo está, no se debe permitir su eliminación para evitar inconsistencias.
        cursor.execute("SELECT COUNT(*) FROM pagos_recurrentes_log WHERE transaccion_id = ?", (id,))
        if cursor.fetchone()[0] > 0:
            return jsonify({ "error": "No se puede eliminar. Este movimiento está asociado a un pago recurrente o de tarjeta. Elimine el pago desde el panel de recurrentes si es necesario." }), 409 # 409 Conflict

        # Si no está vinculada, proceder con la eliminación.
        cursor.execute("DELETE FROM transacciones WHERE id = ?", (id,))
        
        if cursor.rowcount == 0:
            return jsonify({ "error": "Movimiento no encontrado." }), 404

        db.commit()
        return jsonify({ "mensaje": "Movimiento eliminado exitosamente." }), 200
    except Exception as e:
        return jsonify({ "error": f"Error inesperado: {e}" }), 500

# --- === API DE RECURRENTES === ---
@app.route('/api/recurrente', methods=['POST'])
@login_required
def agregar_recurrente():
    try:
        datos = request.form
        # Por defecto es 'gasto' si no se especifica
        tipo = datos.get('tipo', 'gasto') 
        moneda = datos.get('moneda', 'ARS')
        
        if not all([datos.get('descripcion'), datos.get('monto_estimado'), datos.get('dia_vencimiento'), datos.get('categoria_id')]):
            return jsonify({ "error": "Faltan campos obligatorios." }), 400
        
        db = get_db()
        cursor = db.cursor()
        cursor.execute(
            "INSERT INTO gastos_recurrentes (descripcion, monto_estimado, dia_vencimiento, categoria_id, observacion, tipo, moneda) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (datos['descripcion'], float(datos['monto_estimado']), int(datos['dia_vencimiento']), int(datos['categoria_id']), datos.get('observacion'), tipo, moneda)
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
        hoy = date.today()
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
        hoy = date.today()
        
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
        datos = request.form
        comprobante_file = request.files.get('comprobante')
        hoy = date.today()
        db = get_db()
        
        comprobante_path = guardar_comprobante(comprobante_file)
        cursor = db.cursor()
        with db:
            cursor.execute("SELECT * FROM gastos_recurrentes WHERE id=?", (datos['recurrente_id'],))
            recurrente = cursor.fetchone()
            
            # Usamos el tipo del recurrente (ingreso o gasto)
            tipo_movimiento = recurrente['tipo'] 
            
            # Texto dinámico según el tipo
            accion_txt = "Cobro" if tipo_movimiento == 'ingreso' else "Pago"
            desc = f"{accion_txt} recurrente: {recurrente['descripcion']}"
            
            # Insertamos usando el 'tipo_movimiento' correcto (esto arregla la resta/suma)
            cursor.execute("INSERT INTO transacciones (descripcion, monto, tipo, fecha, categoria_id, moneda, comprobante_path) VALUES (?, ?, ?, ?, ?, ?, ?)",
                           (desc, float(datos['monto_pagado']), tipo_movimiento, hoy, recurrente['categoria_id'], recurrente['moneda'], comprobante_path))
            
            new_id = cursor.lastrowid
            cursor.execute("INSERT INTO pagos_recurrentes_log (recurrente_id, transaccion_id, mes, anio) VALUES (?, ?, ?, ?)",
                           (datos['recurrente_id'], new_id, hoy.month, hoy.year))
        return jsonify({ "mensaje": "Procesado exitosamente" }), 201
    except Exception as e: return jsonify({ "error": f"Error: {e}" }), 500

# --- === API DASHBOARD === ---
@app.route('/api/dashboard/summary')
@login_required
def get_dashboard_summary():
    try:
        hoy = date.today()
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
        datos = request.form
        f = date.fromisoformat(datos['fecha_inicio'])
        # Capturamos el ID de la tarjeta (puede venir vacío)
        rec_id_str = datos.get('recurrente_id')
        rec_id = int(rec_id_str) if rec_id_str and rec_id_str.isdigit() else None
        moneda = datos.get('moneda', 'ARS')
        
        db = get_db()
        cursor = db.cursor()
        cursor.execute(
            "INSERT INTO planes_cuotas (descripcion, monto_total, monto_cuota, total_cuotas, fecha_inicio, categoria_id, recurrente_id, cuota_actual, moneda) VALUES (?,?,?,?,?,?,?,0,?)",
            (datos['descripcion'], float(datos['monto_total']), float(datos['monto_cuota']), int(datos['total_cuotas']), f, int(datos['categoria_id']), rec_id, moneda)
        )
        db.commit()
        return jsonify({ "mensaje": "Plan guardado" }), 201
    except Exception as e: return jsonify({ "error": str(e) }), 500

@app.route('/api/cuotas/status')
@login_required
def get_cuotas_status():
    try:
        hoy = date.today()
        db = get_db()
        cursor = db.cursor()
        # Agregamos p.recurrente_id a la consulta
        # y un campo para saber si está asociado a una tarjeta.
        cursor.execute("""
            SELECT p.id, p.descripcion, p.monto_total, p.monto_cuota, p.total_cuotas, p.cuota_actual, strftime('%Y-%m-%d', p.fecha_inicio) as fecha_inicio, p.categoria_id, p.ultimo_pago_mes, p.ultimo_pago_anio, p.recurrente_id, p.moneda, c.nombre AS categoria_nombre, r.descripcion AS tarjeta_nombre,
            CASE WHEN p.ultimo_pago_anio = ? AND p.ultimo_pago_mes = ? THEN 'Pagado este mes' ELSE 'Pendiente este mes' END as status_mes
            FROM planes_cuotas p 
            JOIN categorias c ON p.categoria_id = c.id
            LEFT JOIN gastos_recurrentes r ON p.recurrente_id = r.id
            WHERE p.cuota_actual < p.total_cuotas ORDER BY p.id ASC
        """, (hoy.year, hoy.month))
        return jsonify([dict(f) for f in cursor.fetchall()]), 200
    except Exception as e: return jsonify({ "error": str(e) }), 500

@app.route('/api/cuota/pagar', methods=['POST'])
@login_required
def pagar_cuota():
    try:
        datos = request.form
        comprobante_file = request.files.get('comprobante')
        cant = int(datos.get('cantidad_cuotas', 1))
        hoy = date.today()
        db = get_db()

        comprobante_path = guardar_comprobante(comprobante_file)
        cursor = db.cursor()
        with db:
            cursor.execute("SELECT * FROM planes_cuotas WHERE id=?", (datos['plan_id'],))
            plan = cursor.fetchone()
            
            restantes = plan['total_cuotas'] - plan['cuota_actual']
            if cant > restantes:
                return jsonify({ "error": f"No puedes pagar {cant}, solo quedan {restantes}." }), 400

            monto_total = plan['monto_cuota'] * cant
            desc = f"Pago Cuota(s) ({plan['cuota_actual']+1} a {plan['cuota_actual']+cant}/{plan['total_cuotas']}): {plan['descripcion']}"
            if cant == 1: desc = f"Pago Cuota ({plan['cuota_actual']+1}/{plan['total_cuotas']}): {plan['descripcion']}"
            
            cursor.execute("INSERT INTO transacciones (descripcion, monto, tipo, fecha, categoria_id, moneda, comprobante_path) VALUES (?, ?, 'gasto', ?, ?, ?, ?)",
                           (desc, monto_total, hoy, plan['categoria_id'], plan['moneda'], comprobante_path))
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
        f = date.fromisoformat(d['fecha_inicio'].split('T')[0]) # Tomamos solo la parte de la fecha
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
            SELECT t.id, t.descripcion, t.monto, t.tipo, t.moneda, strftime('%Y-%m-%d', t.fecha) as fecha, c.nombre AS categoria_nombre, t.comprobante_path
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
        # Cambiamos a request.form y request.files
        datos = request.form
        comprobante_file = request.files.get('comprobante')
        recurrente_id = datos.get('recurrente_id')
        monto_pagado = float(datos.get('monto_pagado', 0))
        
        hoy = date.today()
        db = get_db()

        comprobante_path = guardar_comprobante(comprobante_file)
        cursor = db.cursor()

        with db:
            # 1. Obtener info del recurrente (La tarjeta en sí)
            cursor.execute("SELECT * FROM gastos_recurrentes WHERE id=?", (recurrente_id,))
            tarjeta = cursor.fetchone()
            if not tarjeta: return jsonify({"error": "Tarjeta no encontrada"}), 404
            
            # La moneda del pago es la moneda de la tarjeta recurrente.
            moneda_pago = tarjeta['moneda']

            # 2. Identificar y procesar las cuotas pendientes asociadas a esta tarjeta.
            nombres_planes = []
            monto_total_cuotas = 0

            # Buscamos cuotas pendientes de este mes para esta tarjeta y moneda
            cursor.execute("""
                SELECT * FROM planes_cuotas 
                WHERE recurrente_id = ? AND moneda = ? AND cuota_actual < total_cuotas
                AND (ultimo_pago_anio IS NULL OR ultimo_pago_anio < ? OR (ultimo_pago_anio = ? AND ultimo_pago_mes < ?))
            """, (recurrente_id, moneda_pago, hoy.year, hoy.year, hoy.month))
            
            cuotas_pendientes = cursor.fetchall()

            for plan in cuotas_pendientes:
                nombres_planes.append(plan['descripcion'])
                monto_total_cuotas += plan['monto_cuota']
                cursor.execute(
                    "UPDATE planes_cuotas SET cuota_actual = cuota_actual + 1, ultimo_pago_mes=?, ultimo_pago_anio=? WHERE id=?",
                    (hoy.month, hoy.year, plan['id'])
                )

            # 3. Crear la descripción de la transacción
            detalles = ", ".join(nombres_planes)
            monto_otros = monto_pagado - monto_total_cuotas
            desc = f"Resumen {tarjeta['descripcion']} ({moneda_pago})"
            if detalles: desc += f" (Cuotas: {detalles})"
            if monto_otros > 0:
                desc += f" + Otros consumos"

            # 4. Insertar la transacción ÚNICA por el total
            cursor.execute(
                "INSERT INTO transacciones (descripcion, monto, tipo, fecha, categoria_id, moneda, comprobante_path) VALUES (?, ?, 'gasto', ?, ?, ?, ?)",
                (desc, monto_pagado, hoy, tarjeta['categoria_id'], moneda_pago, comprobante_path)
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

# --- RUTA PARA SERVIR ARCHIVOS ---
@app.route('/uploads/<path:filepath>')
@login_required
def serve_upload(filepath):
    """Sirve un archivo desde la carpeta de uploads de forma segura."""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filepath)

# --- === API DE WEBAUTHN (AUTENTICACIÓN BIOMÉTRICA) === ---

@app.route('/api/webauthn/register-begin', methods=['POST'])
@login_required # Solo un usuario logueado puede registrar un dispositivo
def webauthn_register_begin():
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT credential_id FROM webauthn_credentials")
    existing_credentials = [row[0] for row in cursor.fetchall()]

    options = generate_registration_options(
        rp_id=RP_ID,
        rp_name=RP_NAME,
        user_id=b"master_user", # ID de usuario fijo para esta app (debe ser bytes)
        user_name="Usuario Principal", # Este puede ser un string
        exclude_credentials=[{"id": cred_id, "type": "public-key"} for cred_id in existing_credentials]
    )
    session['webauthn_challenge'] = options['challenge']
    return jsonify(options)

@app.route('/api/webauthn/register-complete', methods=['POST'])
@login_required
def webauthn_register_complete():
    body = request.get_json()
    challenge = session.pop('webauthn_challenge', None)

    try:
        verification = verify_registration_response(
            credential=body,
            expected_challenge=challenge,
            expected_origin=ORIGIN,
            expected_rp_id=RP_ID,
            require_user_verification=True
        )

        db = get_db()
        cursor = db.cursor()
        cursor.execute(
            "INSERT INTO webauthn_credentials (credential_id, public_key, sign_count) VALUES (?, ?, ?)",
            (verification.credential_id, verification.credential_public_key, verification.sign_count)
        )
        db.commit()
        return jsonify({"verified": True, "mensaje": "Dispositivo registrado con éxito."})
    except Exception as e:
        return jsonify({"verified": False, "error": f"Fallo en la verificación: {e}"}), 400

@app.route('/api/webauthn/login-begin', methods=['POST'])
def webauthn_login_begin():
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT credential_id FROM webauthn_credentials")
    existing_credentials = [row[0] for row in cursor.fetchall()]

    if not existing_credentials:
        return jsonify({"error": "No hay dispositivos registrados para inicio de sesión biométrico."}), 404

    options = generate_authentication_options(
        rp_id=RP_ID,
        allow_credentials=[{"id": cred_id, "type": "public-key"} for cred_id in existing_credentials]
    )
    session['webauthn_challenge'] = options['challenge']
    return jsonify(options)

@app.route('/api/webauthn/login-complete', methods=['POST'])
def webauthn_login_complete():
    body = request.get_json()
    challenge = session.pop('webauthn_challenge', None)
    credential_id = base64url_to_bytes(body['id'])

    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT * FROM webauthn_credentials WHERE credential_id = ?", (credential_id,))
    credential_data = cursor.fetchone()

    if not credential_data:
        return jsonify({"verified": False, "error": "Credencial no reconocida."}), 404

    try:
        verification = verify_authentication_response(
            credential=body,
            expected_challenge=challenge,
            expected_rp_id=RP_ID,
            expected_origin=ORIGIN,
            credential_public_key=credential_data['public_key'],
            credential_current_sign_count=credential_data['sign_count'],
            require_user_verification=True
        )
        # ¡Éxito! El usuario está autenticado.
        # Hacemos la sesión permanente para que se aplique el timeout
        session.permanent = True
        session['logged_in'] = True
        # Actualizamos el contador de firmas para prevenir clonación de credenciales
        cursor.execute("UPDATE webauthn_credentials SET sign_count = ? WHERE id = ?", (verification.new_sign_count, credential_data['id']))
        db.commit()
        return jsonify({"verified": True})
    except Exception as e:
        return jsonify({"verified": False, "error": f"Fallo en la verificación: {e}"}), 400

# --- INICIO SERVIDOR ---
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)