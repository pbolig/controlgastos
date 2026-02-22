# Documentación Funcional - Sistema de Control de Gastos v2.0.0

## 1. Descripción General
**Control de Gastos** es una aplicación web diseñada para registrar, categorizar y analizar movimientos financieros personales. El sistema permite gestionar ingresos, gastos, movimientos recurrentes, planes de pago en cuotas y resúmenes de tarjetas de crédito. Adicionalmente, cuenta con soporte multimoneda (principalmente ARS y USD).

## 2. Tipos de Usuarios y Seguridad
- **Usuario Único (Administrador):** El sistema está pensado para un único usuario final o un entorno de uso personal/confianza.
- **Autenticación Clásica:** Acceso mediante una contraseña maestra única configurada a nivel servidor.
- **Autenticación Biométrica (WebAuthn):** Permite registrar dispositivos (hardware keys, Touch ID, Windows Hello, etc.) para un inicio de sesión rápido, seguro y sin contraseña.
- **Gestión de Sesión:** Cierre de sesión automático tras 30 minutos de inactividad para proteger la privacidad de los datos.

## 3. Módulos Principales

### 3.1. Dashboard (Panel Principal)
Proporciona una vista general rápida de la situación financiera del mes en curso, consolidando los datos en diferentes monedas (ARS y USD).
- **Indicadores Principales:** Total de Ingresos, Total de Gastos, Saldo Mensual (Ingresos - Gastos), y Total de Compromisos Pendientes (Gastos recurrentes del mes que aún no se han pagado).

### 3.2. Gestión de Transacciones (Movimientos)
Es el núcleo central donde se registra el alta de ingresos o gastos que afectan los saldos diarios.
- **Datos registrados:** Descripción, Monto, Tipo (Ingreso/Gasto), Categoría, Fecha de ejecución y Moneda.
- **Comprobantes:** Opción para adjuntar archivos (imágenes, PDFs) como respaldos del movimiento.
- **Validaciones de Integridad:** El sistema bloquea la eliminación de transacciones que estén vinculadas a pagos de cuotas o gastos recurrentes (tarjetas), requiriendo que la cancelación se haga desde el módulo correspondiente para no romper el historial.

### 3.3. Categorías
Permite clasificar los movimientos financieros para facilitar el análisis (ej: Supermercado, Alquiler, Sueldo). Las categorías son introducidas dinámicamente por el usuario para adaptar el sistema a su realidad financiera.

### 3.4. Gastos e Ingresos Recurrentes
Módulo para administrar obligaciones o ingresos de naturaleza cíclica (períodos mensuales), como servicios, suscripciones o salarios.
- **Características Funcionales:**
  - Registro con un monto estimado y un día fijo de vencimiento dentro del mes.
  - Al procesar el pago desde este módulo, el sistema genera automáticamente la "Transacción" real y la marca en el registro histórico del mes.
  - Posibilidad de **"Omitir"** un mes (para recurrentes que no aplican un mes en particular pero que no se desean borrar).
  - Consulta de un historial detallado visualizando los últimos 6 pagos de cada ítem recurrente.

### 3.5. Gestión de Tarjetas y Planes de Cuotas
Módulo para registrar y dar seguimiento a compras financiadas (ej: electrodomésticos, viajes).
- **Configuración del Plan:** Requiere Descripción, Monto Total, Monto de la Cuota, Total de Cuotas y Fecha de inicio. Pueden vincularse a una tarjeta de crédito específica (previamente registrada como un gasto recurrente).
- **Pago Individual de Cuotas:** El usuario puede seleccionar pagar 1 o más cuotas en un mismo acto, actualizando el progreso y descontando del total de cuotas pendientes.
- **Pago Global del Resumen de Tarjeta (Feature Avanzado):** Permite abonar en un solo paso todas las cuotas pendientes que vencen en el mes corriente, unificándolas bajo una misma tarjeta y calculando el remanente (otros consumos de tarjeta que no son cuotas). Esto crea una única transacción en los libros contables.

### 3.6. Reportes y Consultas
Una vista analítica que permite aplicar filtros multicriterio sobre el historial de transacciones, devolviendo la información para el análisis posterior.
- **Filtros Soportados:** Rango de fechas (Desde/Hasta), Tipo (Ingresos/Gastos), Categorías seleccionables, y Moneda específica.

## 4. Gestión de Archivos (Uploads)
La plataforma centraliza los comprobantes (facturas, comprobantes de pago) subidos por el usuario en una estructura organizada por año (`/uploads/YYYY/`). Al guardar, se renombra el archivo utilizando identificadores únicos (UUID) manteniendo su extensión, con el doble fin de evitar superposiciones de nombres de distintos archivos y añadir un nivel extra de seguridad.

## 5. Arquitectura General y Tecnologías involucradas
- **Backend:** Python con *Flask* como framework web.
- **Persistencia de Datos:** *SQLite* integrado, administrando tablas interrelacionadas para transacciones, recurrentes, planes de pago y log de pagos.
- **Frontend:** HTML renderizado desde servidor de plantillas (Jinja2), interactuando de forma asincrónica usando endpoints de API RESTful.
- **Seguridad WebAuthn:** Integración de la biblioteca `webauthn` para manejo del estándar FIDO2 / WebAuthn.
