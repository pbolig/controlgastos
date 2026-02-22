# Documentación Técnica - Sistema de Control de Gastos v2.0.0

## 1. Arquitectura y Stack Tecnológico

La aplicación sigue una arquitectura monolítica tradicional cliente-servidor con renderizado de vistas (SSR) parcial y fuerte uso de API RESTful con JavaScript en el frontend (AJAX/Fetch).

- **Backend:** Python + Flask (`app.py`).
- **Base de Datos:** SQLite (`gastos.db`).
- **Autenticación (Nativa):** Validación mediante contraseña compartida (`PASSWORD_MAESTRA`) comparada con variables de entorno o un valor por defecto.
- **Autenticación (Biométrica):** Implementación de FIDO2/WebAuthn mediante la librería Python `webauthn`.
- **Almacenamiento de Archivos:** Local, dentro del directorio predeterminado `/uploads/{Año}`.
- **Frontend HTML/View layer:** Jinja2 (vistas en `/templates/`).

## 2. Estructura de la Base de Datos (Modelo Relacional)

La base de datos SQLite se compone de 5, más una tabla implícita para credenciales WebAuthn, principales con un diseño relacional estricto activado mediante `PRAGMA foreign_keys = ON;`.

### 2.1. Tablas

*   `categorias`:
    *   `id` (PK, Auto), `nombre` (Text, Unique).
*   `transacciones` (El libro diario real):
    *   `id` (PK, Auto), `descripcion` (Text), `monto` (Real), `tipo` (Text: 'ingreso' o 'gasto'), `fecha` (Date), `categoria_id` (FK), `moneda` (Text, def:'ARS'), `comprobante_path` (Text, para archivos locales).
*   `gastos_recurrentes` (Plantillas de movimientos mensuales - Incluye Tarjetas):
    *   `id` (PK, Auto), `descripcion` (Text), `monto_estimado` (Real), `dia_vencimiento` (Integer), `categoria_id` (FK), `observacion` (Text), `tipo` (Text, def:'gasto'), `moneda` (Text, def:'ARS').
*   `pagos_recurrentes_log` (El puente de historial mes a mes):
    *   `id` (PK, Auto), `recurrente_id` (FK), `transaccion_id` (FK hacia la transacción real, Null si fue "omitido"), `mes` (Integer), `anio` (Integer).
*   `planes_cuotas` (Para préstamos o consumos de TC):
    *   `id` (PK, Auto), `descripcion` (Text), `monto_total` (Real), `monto_cuota` (Real), `total_cuotas` (Integer), `cuota_actual` (Integer, def:0), `fecha_inicio` (Date), `categoria_id` (FK), `ultimo_pago_mes` (Integer), `ultimo_pago_anio` (Integer), `recurrente_id` (FK opcional, vínculo a Tarjeta de Crédito), `moneda` (Text, def:'ARS').
*   `webauthn_credentials` (Asumida desde la implementación WebAuthn en Flask): Almacena las `public_key` y el `sign_count` de los dispositivos biométricos de los usuarios.

## 3. Endpoints de la API (Flask routes)

Todas las rutas dentro de `/api/` protegen su acceso devolviendo `401 Unauthorized` si no existe la cookie de sesión validada, gracias al decorador `@login_required`.

### 3.1. Autenticación y WebAuthn
*   `GET /login`, `POST /login`: Valida la `PASSWORD_MAESTRA` por formulario.
*   `GET /logout`: Invalida y limpia la sesión.
*   `POST /api/webauthn/register-begin` & `register-complete`: API para inscribir dispositivos biométricos en la Base de Datos.
*   `POST /api/webauthn/login-begin` & `login-complete`: Reto y respuesta criptográfica para firmar el acceso simulando login por contraseña.

### 3.2. Dashboard y Transacciones Principales
*   `GET /api/dashboard/summary`: Agrega ingresos, gastos, pendientes y saldo, devolviendo información estructurada por Moneda (`ARS` y `USD`).
*   `GET /api/categorias`: Retorna lista ordenada de categorías disponibles.
*   `POST /api/categoria`: Inserta nueva categoría en BBDD (`UNIQUE constraint` previene duplicados).
*   `GET /api/transacciones`: Lista *inner-joineada* con la tabla categorías para proveer su nombre.
*   `POST /api/transaccion`: Recibe `multipart/form-data`. Valida requeridos, guarda el archivo físico si es que lo hay mediante la función utilitaria `guardar_comprobante()`, y posteriormente guarda el registro en BBDD.
*   `DELETE /api/transaccion/<id>`: *Control de Borrado*. Realiza una petición `SELECT COUNT(*)` a `pagos_recurrentes_log`. Si la transacción está en el log (es un pago automático/tarjeta), rechaza el borrado (`409 Conflict`) para no romper la contabilidad de la cuota o tarjeta.

### 3.3. Recurrentes (Suscripciones, Tarjetas Mensuales, Servicios)
*   `GET /api/recurrentes/status`: Compleja Query SQL que lista todos los recurrentes del sistema pero verifica contra `pagos_recurrentes_log` utilizando el mes/año actuales de CPU (`date.today()`) para calcular la columna de estado virtual transitoria: `'Omitido'` (log sin `transaccion_id`), `'Procesado'`, o `'Pendiente'`.
*   `POST /api/recurrente`: Alta lógica a un nuevo item estimado. Admite Ingresos o Gastos (`tipo`).
*   `PUT /api/recurrente/<id>`: Edición destructiva del item base.
*   `POST /api/recurrente/omitir`: Marca como omitido el mes actual insertando un log huérfano (sin ID de transacción vinculada).
*   `POST /api/recurrente/pagar`: Cierra un pendiente depositando una nueva transacción concreta en la BBDD, guarda un comprobante físico si existiera, e inserta en el log referenciando al mes, año, y el nuevo ID originado.
*   `DELETE /api/recurrente/<id>`: Borra un recurrente **y** su historial de pago completo en cascada manual de adentro hacia afuera (borra log, luego item).
*   `GET /api/recurrente/historial/<id>`: Un histórico de los últimos 6 registros `JOIN` con sus transacciones reales para comparar incrementos.

### 3.4. Cuotas y Consumos Financiados
*   `GET /api/cuotas/status`: Lista cuotas activas (`cuota_actual < total_cuotas`). Calcula el estatus del mes comparando `ultimo_pago_mes` e `ultimo_pago_anio` con la fecha en curso.
*   `POST /api/cuota`: Crea un plan vinculable (o no) a una Tarjeta mediante `recurrente_id`.
*   `PUT /api/cuota/<id>`: Modificación del plan.
*   `POST /api/cuota/pagar`: Adelanto o pago natural de X cantidad de cuotas. Incrementa `cuota_actual`, actualiza `ultimo_pago_mes/anio`, y genera una `transaccion`. (Nota: **No** se usa para el resumen de tarjeta global).
*   `POST /api/tarjeta/pagar-resumen`: Una rutina altamente compleja.
    1.  Recibe el ID tarjeta (`gastos_recurrentes`).
    2.  Busca `planes_cuotas` donde `recurrente_id == tarjeta_id` que no hayan sido pagados este mes.
    3.  Actualiza todas esas cuotas (`cuota_actual += 1` y mes pagado al actual).
    4.  Crea un texto dinámico englobando todas las descripciones de las cuotas procesadas, más la leyenda "*+ Otros consumos*" si el monto pagado fue mayor a la sumatoria de las cuotas.
    5.  Crea **solo una transacción** consolidada del pago real por el "monto_pagado".
    6.  Marca la Tarjeta como pagada en `pagos_recurrentes_log`.

### 3.5. Filtros y Reportes
*   `POST /api/reportes/filtrar`: Motor de generación de SQL dinámico a partir de un cuerpo JSON. Escapa parámetros manualmente mediante append a la lista de tuplas para evitar Inyecciones SQL, inyectando condiciones (WHERE `fecha_desde`, `fecha_hasta`, `categoria`, `tipo`, `moneda`) solo si estas llegaron informadas.

## 4. Gestión de Archivos en Servidor

*   La carga se realiza en `multipart/form-data`.
*   `guardar_comprobante(file_storage)` gestiona la validación. Transforma el nombre base con la función de Werkzeug `secure_filename()` e inyecta un `uuid4().hex` único previniendo Path Traversal. Devuelve la ruta relativa persistible (`YYYY/hash.jpg`).
*   Los binarios en `/uploads/<path>` están servidos por una ruta en Flask (`serve_upload()`), protegida a priori por `@login_required` impidiendo a observadores externos enumerar o descargar las fotos de comprobantes por fuera del uso autenticado del sistema.

## 5. Diseño y Dependencias

*   **Variables de Entorno Cruciales:**
    *   `PASSWORD_MAESTRA`
    *   `WEBAUTHN_RP_ID` (ej: `localhost` o dominio producción)
    *   `WEBAUTHN_ORIGIN` (ej: `http://localhost:5000` o `https` en prod).
*   **Dependencias principales** (`requirements.txt` asumido desde `app.py`):
    *   `Flask` (Core web)
    *   `webauthn` (Lib FIDO)
    *   `werkzeug` (Util para nombre archivos y core WSGI)
