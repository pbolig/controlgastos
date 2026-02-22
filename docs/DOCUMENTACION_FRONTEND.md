# Documentación Frontend - Sistema de Control de Gastos v2.0.0

## 1. Tecnologías y Estructura

El frontend está construido utilizando tecnologías web estándar sin frameworks de SPA (Single Page Application) pesados como React o Angular, priorizando la ligereza y rapidez de ejecución.

- **Estructura HTML:** Renderizado inicial apoyado parcialmente por Jinja2 desde Flask (para inyectar variables como `version` o banderas `webauthn_enabled`).
- **Estilos:** CSS3 puro (`style.css`), utilizando un diseño *Responsive* basado en CSS Grid y Flexbox.
- **Interacción y Lógica Cliente:** JavaScript Vanilla (`app.js`, `reportes.js` y `login.js`), utilizando `fetch` para la comunicación asíncrona con la API REST del backend.
- **Gráficos:** Librería externa `Chart.js` (cargada via CDN) para el renderizado visual en el módulo de reportes.
- **Tipografía:** *Inter* importada desde Google Fonts.

## 2. Organización de Archivos

Directorio `/templates/` (Vistas HTML)
- `index.html`: Dashboard principal, aloja los widgets de resumen, carga de datos y las tablas maestras de datos vivos (transacciones, recurrentes y cuotas actuales).
- `reportes.html`: Interfaz analítica para aplicar filtros y ver los reportes globales renderizados en tablas y gráficos de torta.
- `login.html`: Pantalla de autenticación y fallback para el inicio de sesión por contraseña tradicional.

Directorio `/static/css/` (Estilos)
- `style.css`: Posee estilos genéricos para botones, colores temáticos de transacciones (`.text-success`, `.text-danger`), estructura de tarjetas (`.widget`, `.summary-card`), tablas, *media queries* para adaptar a móviles (max-width `768px` y `600px`) y superposiciones de ventanas modales (`.confirm-overlay`, `.confirm-dialog`).

Directorio `/static/js/` (JavaScript Lógico)
- `app.js`: Script principal (800+ líneas) del dashboard. Contiene todo el enrutamiento visual, renderizado dinámico de tablas y controladores de eventos base.
- `reportes.js`: Aislado para manejar la lógica de Chart.js y las peticiones complejas de la pantalla de Reportes.
- `login.js`: Dedicado a manejar la interacción de ingreso, especialmente la integración de login biométrico WebAuthn con la API del navegador `navigator.credentials.get`.

## 3. Arquitectura del Archivo Principal (`app.js`)

El corazón de la interfaz de usuario recae en `app.js`, que está estructurado mediante un patrón *Module-Like* envuelto en un evento `DOMContentLoaded`:

### 3.1. Funciones Centralizadas
*   **`apiCall(endpoint, method, body)`**: Un *wrapper* sobre nativo `fetch` que intercepta `FormData` para envío de comprobantes, agrupa las cabeceras `Content-Type: application/json` automáticas, parsea los resultados JSON y maneja la captura global de excepciones lanzando un `alert` si la llamada HTTP falla.
*   **`formatearMoneda(numero, moneda)`**: Utiliza la API `Intl.NumberFormat` del navegador nativo para parsear números según los locale de `"es-AR"`.
*   **`mostrarMensaje(texto)`**: Implementa un pequeño sistema de *Toasts* visuales (notificaciones emergentes) dinámicos que se auto-destruyen luego de 2.5 segundos.

### 3.2. Renderizado de Interfaz (Las Tablas)
No hay recargas de página para mostrar los datos; el sistema inyecta HTML (vía `insertAdjacentHTML`) generado por las funciones:
*   `crearFilaTransaccion(t)`
*   `crearFilaRecurrente(r)`
*   `crearFilaCuota(p)`
Estas leen el objeto proveniente de la base de datos para dibujar botones dinámicos basados en en el estado (e.g., inyectan el botón "Resumen 💳" y bloquean el "Pagar" genérico si una cuota está listada bajo una tarjeta).

### 3.3. Delegación de Eventos (Event Delegation)
En lugar de añadir *Event Listeners* a miles de botones individuales, `app.js` maneja una única escucha en componentes padres (como `tablaRecurrentesBody` o `tablaCuotasBody`) apoyándose en diccionarios o 'Mapas de Acciones':
*   `accionesRecurrentes`
*   `accionesCuotas`
*   `accionesTransacciones`
Esta decisión de diseño hace que la aplicación consuma menos memoria RAM y sea súper responsiva cuando se redibujan las tablas.

### 3.4. Modales Multi-Propósito
La UI se comunica con el usuario en acciones críticas (pagos adelantados, eliminaciones) vía Modales HTML (`div.confirm-overlay`).
*   **Modal de Pago de Tarjeta (`abrirModalTarjeta`)**: Renderiza un form *on-the-fly* calculando previamente (sumando `p.monto_cuota`) el monto sugerido para todos los consumos encontrados por el backend pendientes de ese mes y listando todas sus descripciones en pantalla antes de confirmar.
*   **Modal de Pago Genérico**: Se reutiliza pasando sus características por parámetros (`titulo`, `descripción`, callback a ejecutar on-success) lo que facilita pagar Recurrentes y Cuotas sencillas reciclando el mismo HTML.

## 4. Componente Reportes (`reportes.js` y `reportes.html`)
Una página separada que se independiza del estado diario.
- **Generación Dinámica de Filtros:** Utiliza el DOM para capturar datos de selectores (`<select>`) de Fechas, Tipos, y Moneda y arma un solo JSON hacia la API de Búsqueda.
- **Gráfico (Chart.js):** Procesa el Array de respuesta de transacciones. Agrupa los totales por iteración reduciendo el vector hacia las categorías existentes y dibuja un "Pie Chart" (gráfico de pastel). Escucha constantemente los selectores "ARS/USD" propios del canvas del gráfico para no mezclar unidades en un mismo reporte visual.

## 5. Accesibilidad y Experiencia Operativa
- Sistema de **Session Timeout UI:** Implementado internamente en el JS. Restablece un contador tras eventos de ratón/teclado. Al superar los 30 Minutos redirige a `/logout`.
- Manejo asíncrono de Modales (Cierre por teclado con tecla *Escape*).
- Formularios interactivos: Capacidad de añadir lógicamente una tarjeta de crédito o una categoría *on-the-fly* a través de scripts inyectados en los botones `+` al lado de los selects, solicitando interrupción en tiempo real por `prompt()` y autoseleccionando luego la opción fresca recién generada desde la API, sin forzar a actualizar manualmente partes del form.
