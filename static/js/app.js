document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Cargado. Ejecutando app.js v12 (Multimoneda + Historial + Omitir)...");

    // --- 1. SELECTORES ---
    // Dashboard (Ahora buscamos los contenedores por ID para llenarlos por clase)
    const cardIngresos = document.getElementById('summary-ingresos');
    const cardGastos = document.getElementById('summary-gastos');
    const cardPendiente = document.getElementById('summary-pendiente');
    const cardSaldo = document.getElementById('summary-saldo');

    // Formularios
    const formTransaccion = document.getElementById('form-transaccion');
    const formMensaje = document.getElementById('form-mensaje');
    const selectCategoria = document.getElementById('categoria'); 

    const formRecurrente = document.getElementById('form-recurrente');
    const formRecurrenteTitulo = document.getElementById('form-recurrente-titulo');
    const formRecurrenteMensaje = document.getElementById('form-recurrente-mensaje');
    const btnSubmitRecurrente = document.getElementById('btn-submit-recurrente');
    const btnCancelarEdicion = document.getElementById('btn-cancelar-edicion');
    const selectRecurrenteTipo = document.getElementById('recurrente-tipo');
    
    const formCuota = document.getElementById('form-cuota');
    const formCuotaTitulo = document.getElementById('form-cuota-titulo');
    const formCuotaMensaje = document.getElementById('form-cuota-mensaje');
    const btnSubmitCuota = document.getElementById('btn-submit-cuota');
    const btnCancelarEdicionCuota = document.getElementById('btn-cancelar-edicion-cuota');
    const selectCuotaCategoria = document.getElementById('cuota-categoria');
    const selectCuotaRecurrente = document.getElementById('cuota-recurrente');

    // Tablas
    const tablaBody = document.getElementById('lista-transacciones-body');
    const tablaRecurrentesBody = document.getElementById('lista-recurrentes-body');
    const tablaCuotasBody = document.getElementById('lista-cuotas-body');
    const selectRecurrenteCategoria = document.getElementById('recurrente-categoria');

    // Modals HISTORIAL
    const modalHistorial = document.getElementById('modal-historial');
    const tbodyHistorial = document.querySelector('#tabla-historial-contenido tbody');
    const loadingHistorial = document.getElementById('historial-loading');
    const btnCerrarHistorial = document.getElementById('btn-cerrar-historial');
    
    // Globales
    let tarjetasDisponibles = [];

    // --- 2. FUNCIONES AUXILIARES ---

    function mostrarMensaje(texto) {
        const toast = document.createElement('div');
        toast.textContent = texto;
        toast.style.cssText = `position: fixed; top: -100px; left: 50%; transform: translateX(-50%); background: #7e9d0dff; color: white; padding: 15px 25px; border-radius: 10px; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: top 0.3s ease;`;
        document.body.appendChild(toast);
        setTimeout(() => toast.style.top = '20px', 10);
        setTimeout(() => { toast.style.top = '-100px'; setTimeout(() => toast.remove(), 300); }, 2500);
    }

    function formatearMoneda(numero, moneda = 'ARS') { // Ahora recibe la moneda
        const num = parseFloat(numero);
        if (isNaN(num)) return "$0.00";
        // Si es USD, usamos el código 'USD', si no, siempre 'ARS' para el formato local.
        const currencyCode = moneda.toUpperCase() === 'USD' ? 'USD' : 'ARS';
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: currencyCode }).format(num);
    }

    /**
     * REFACTORIZACIÓN: Función centralizada para llamadas a la API.
     * Maneja la configuración, el envío y la gestión básica de errores.
     * @param {string} endpoint - La URL del API a la que llamar.
     * @param {string} method - El método HTTP (GET, POST, PUT, DELETE).
     * @param {object} [body=null] - El cuerpo de la petición para POST/PUT.
     * @returns {Promise<any>} - La respuesta JSON del servidor.
     */
    async function apiCall(endpoint, method = 'GET', body = null) {
        const isFormData = body instanceof FormData;
        const options = {
            method,
            headers: {}, // Los headers se ajustan dinámicamente
        };

        if (isFormData) {
            options.body = body; // Para FormData, no se setea Content-Type, el browser lo hace.
        } else if (body) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
        try {
            const response = await fetch(endpoint, options);
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || `Error ${response.status}`);
            }
            return data;
        } catch (error) {
            alert(`Error en la operación: ${error.message}`);
            throw error; // Relanzamos para que el llamador pueda manejarlo si es necesario.
        }
    }

    // --- 3. CARGA INICIAL Y FUNCIONES DE CARGA DE DATOS ---

    async function cargarCategorias() {
        try {
            const data = await apiCall('/api/categorias');
            // REFACTOR: Limpiamos y repoblamos los selects de categoría de forma centralizada.
            [selectCategoria, selectRecurrenteCategoria, selectCuotaCategoria].forEach(sel => {
                if (!sel) return;
                sel.innerHTML = ''; // Limpiamos todas las opciones
                sel.appendChild(new Option("Sin Categoría", ""));
                data.forEach(c => sel.appendChild(new Option(c.nombre, c.id)));
            });
        } catch (error) {
            console.error("No se pudieron cargar las categorías.", error);
        }
    }

    async function cargarTransacciones() {
        if (!tablaBody) return;
        try {
            const data = await apiCall('/api/transacciones');
            tablaBody.innerHTML = '';
            data.forEach(t => tablaBody.insertAdjacentHTML('beforeend', crearFilaTransaccion(t)));
        } catch (error) {
            console.error("Error cargando transacciones", error);
        }
    }

    async function cargarRecurrentesStatus() {
        if (!tablaRecurrentesBody) return;
        try {
            const data = await apiCall('/api/recurrentes/status');
            tablaRecurrentesBody.innerHTML = '';
            // Guardar tarjetas para el combo de cuotas
            tarjetasDisponibles = data.filter(r => r.tipo === 'tarjeta');
            actualizarSelectTarjetas();

            if (data.length === 0) {
                tablaRecurrentesBody.innerHTML = '<tr><td colspan="6">No hay datos.</td></tr>';
            } else {
                data.forEach(r => tablaRecurrentesBody.insertAdjacentHTML('beforeend', crearFilaRecurrente(r)));
            }
        } catch (error) {
            console.error("Error cargando recurrentes", error);
        }
    }

    async function cargarCuotasStatus() {
        if (!tablaCuotasBody) return;
        try {
            const data = await apiCall('/api/cuotas/status');
            tablaCuotasBody.innerHTML = '';
            data.forEach(p => tablaCuotasBody.insertAdjacentHTML('beforeend', crearFilaCuota(p)));
        } catch (error) {
            console.error("Error cargando cuotas", error);
        }
    }

    async function cargarDashboardSummary() {
        try {
            const d = await apiCall('/api/dashboard/summary');

            // FIX: La función 'update' se había perdido en la refactorización. La redefinimos aquí.
            function update(card, sel_ars, val_ars, sel_usd, val_usd) {
                if(card) {
                    const el_ars = card.querySelector(sel_ars);
                    const el_usd = card.querySelector(sel_usd);
                    if(el_ars) {
                        el_ars.textContent = formatearMoneda(val_ars, 'ARS');
                        if(sel_ars.includes('saldo')) el_ars.style.color = val_ars < 0 ? '#e74c3c' : '#2980b9';
                    }
                    if(el_usd) {
                        el_usd.textContent = formatearMoneda(val_usd, 'USD');
                        if(sel_usd.includes('saldo')) el_usd.style.color = val_usd < 0 ? '#e74c3c' : '#27ae60';
                    }
                }
            }

            update(cardIngresos, '.val-ars', d.ARS.ingresos, '.val-usd', d.USD.ingresos);
            update(cardGastos, '.val-ars', d.ARS.gastos, '.val-usd', d.USD.gastos);
            update(cardPendiente, '.val-ars', d.ARS.pendiente, '.val-usd', d.USD.pendiente);
            update(cardSaldo, '.val-ars', d.ARS.saldo, '.val-usd', d.USD.saldo);
        } catch (error) {
            console.error("Error cargando el dashboard", error);
        }
    }

    // --- 4. LÓGICA DE RENDERIZADO DE TABLAS (HTML) ---

    function crearFilaTransaccion(t) {
        const color = t.tipo === 'gasto' ? 'red' : 'green';
        const f = t.fecha.split('-');
        const mon = t.moneda || 'ARS';
        
        // Añadimos el botón de comprobante si existe la ruta del archivo
        const comprobanteBtn = t.comprobante_path 
            ? `<a href="/uploads/${t.comprobante_path}" target="_blank" class="btn-accion" title="Ver Comprobante">📎</a>`
            : '';
        
        // Agrupamos todos los botones de acción
        const deleteBtn = `<button class="btn-accion btn-eliminar-transaccion" data-id="${t.id}" title="Eliminar Movimiento">❌</button>`;
        const acciones = `${comprobanteBtn} ${deleteBtn}`;

        return `
            <tr>
                <td>${f[2]}/${f[1]}/${f[0]}</td>
                <td>${t.descripcion}</td>
                <td>${acciones}</td>
                <td>${t.tipo}</td>
                <td style="color:${color}">${t.tipo === 'gasto' ? '-' : '+'}${formatearMoneda(t.monto, mon)}</td>
                <td>${t.categoria_nombre || 'N/A'}</td>
            </tr>`;
    }

    function actualizarSelectTarjetas() {
        if (!selectCuotaRecurrente) return;
        const valorActual = selectCuotaRecurrente.value;
        // Limpiamos solo las opciones de tarjetas, no la de "Crear Nueva"
        Array.from(selectCuotaRecurrente.options).forEach(opt => { if(opt.value && opt.value !== 'nueva_tarjeta') opt.remove(); });
        tarjetasDisponibles.forEach(t => {
            selectCuotaRecurrente.appendChild(new Option(t.descripcion + ` (${t.moneda || 'ARS'})`, t.id));
        });
        if(valorActual) selectCuotaRecurrente.value = valorActual;
    }

    function crearFilaRecurrente(r) {
        const procesado = r.status === 'Procesado' || r.status === 'Pagado';
        let estadoEstilo = 'color: orange;';
        if (procesado) estadoEstilo = 'color: green;';
        else if (r.status === 'Omitido') estadoEstilo = 'color: gray; font-style: italic;';
        
        const mon = r.moneda || 'ARS';
        let btn = '';
        if (r.status === 'Pendiente') {
            if (r.tipo === 'tarjeta') {
                btn = `<button class="btn-tarjeta" data-id="${r.id}" data-desc="${r.descripcion}" style="background:#8e44ad; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; margin-right:5px;">Resumen 💳</button>`;
            } else {
                const txt = r.tipo === 'ingreso' ? 'Cobrar' : 'Pagar';
                const cls = r.tipo === 'ingreso' ? 'btn-cobrar' : 'btn-pagar';
                btn = `<button class="${cls}" data-id="${r.id}" data-monto="${r.monto_estimado}" data-desc="${r.descripcion}" data-tipo="${r.tipo}" data-moneda="${mon}" style="margin-right:5px;">${txt} ${mon}</button>`;
            }
            btn += `<button class="btn-omitir" data-id="${r.id}" data-desc="${r.descripcion}" title="Omitir este mes" style="background:#95a5a6; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">⏸</button>`;
        } else {
            btn = `<span class="text-success">✔ ${r.status}</span>`;
        }
        
        const obsIcon = (r.observacion && r.observacion.trim()) ? ` <span class="obs-tooltip" title="${r.observacion}">ℹ️</span>` : '';
        const histIcon = `<span class="btn-historial" data-id="${r.id}" style="cursor:pointer; margin-left:5px; font-size:1.1em;" title="Ver historial">🕒</span>`;
        const jsonData = JSON.stringify(r).replace(/"/g, '&quot;');

        return `
            <tr>
                <td>
                <td>${r.descripcion} ${obsIcon} ${histIcon}</td>
                <td class="acciones-columna">
                    ${btn}
                    <button class="btn-accion btn-editar-recurrente" data-json="${jsonData}">✏️</button>
                    <button class="btn-accion btn-eliminar-recurrente" data-id="${r.id}" data-desc="${r.descripcion}">❌</button>
                </td>
                <td>Día ${r.dia_vencimiento}</td>
                <td>${formatearMoneda(r.monto_estimado, mon)}</td>
                <td style="${estadoEstilo}">${r.status}</td>
            </tr>`;
    }

    function crearFilaCuota(p) {
        const estilo = p.status_mes.includes('Pagado') ? 'color: green;' : 'color: orange;';
        const mon = p.moneda || 'ARS';
        let btn = '';
        // Si la cuota está asociada a una tarjeta, no se puede pagar individualmente.
        if (p.recurrente_id && p.tarjeta_nombre) {
            btn = `<span style="font-size: 0.85em; color: #8e44ad;">Se paga con Resumen ${p.tarjeta_nombre}</span>`;
        } else if (p.status_mes.includes('Pendiente')) {
            btn = `<button class="btn-pagar-cuota" data-id="${p.id}" data-monto="${p.monto_cuota}" data-moneda="${mon}" data-desc="${p.descripcion}" data-restantes="${p.total_cuotas - p.cuota_actual}">Pagar ${mon}</button>`;
        } else {
            btn = '<span class="text-success">Listo</span>';
        }
        const jsonData = JSON.stringify(p).replace(/"/g, '&quot;');
        return `
            <tr>
                <td>${p.descripcion}</td>
                <td class="acciones-columna">
                    ${btn} 
                    <button class="btn-accion btn-editar-cuota" data-json="${jsonData}">✏️</button> 
                    <button class="btn-accion btn-eliminar-cuota" data-id="${p.id}">❌</button>
                </td>
                <td>${p.cuota_actual}/${p.total_cuotas}</td>
                <td>${formatearMoneda(p.monto_cuota, mon)}</td>
                <td style="${estilo}">${p.status_mes}</td>
            </tr>`;
    }

    // --- 5. MANEJO DE FORMULARIOS ---

    /**
     * REFACTORIZACIÓN: Función genérica para manejar el envío de formularios.
     * @param {HTMLFormElement} form - El formulario a manejar.
     * @param {function} onSucess - Callback a ejecutar tras el éxito.
     */
    async function handleFormSubmit(form, onSuccess) {
        // Usamos FormData directamente para poder enviar archivos.
        const formData = new FormData(form);

        const id = form.dataset.editId;
        const endpoint = id ? `${form.dataset.endpoint}/${id}` : form.dataset.endpoint;
        const method = id ? 'PUT' : 'POST';

        try {
            // Para PUT con FormData, algunos backends esperan los datos en el body, no como form-data.
            // Por simplicidad, si es PUT, lo convertimos a JSON (esto no soporta archivos en edición).
            // Si es POST, enviamos FormData tal cual.
            const datos = (method === 'PUT') ? Object.fromEntries(formData.entries()) : formData;
            
            // La función apiCall debe ser modificada para no siempre usar 'application/json'
            // cuando se envía FormData.

            const d = await apiCall(endpoint, method, datos);
            mostrarMensaje(d.mensaje);
            onSuccess();
        } catch (error) {
            console.error("Error en el formulario:", error);
        }
    }

    function resetFormRecurrente() {
        if (!formRecurrente) return;
        formRecurrente.reset();
        formRecurrenteTitulo.textContent = 'Definir Gasto Recurrente';
        btnSubmitRecurrente.textContent = 'Guardar Recurrente';
        btnCancelarEdicion.style.display = 'none';
        formRecurrente.dataset.editId = '';
        if (selectRecurrenteCategoria) selectRecurrenteCategoria.value = "";
    }
    if(btnCancelarEdicion) btnCancelarEdicion.addEventListener('click', resetFormRecurrente);

    function resetFormCuota() {
        if (!formCuota) return;
        formCuota.reset();
        formCuotaTitulo.textContent = 'Definir Plan de Cuotas';
        btnSubmitCuota.textContent = 'Guardar Plan';
        if(btnCancelarEdicionCuota) btnCancelarEdicionCuota.style.display = 'none';
        formCuota.dataset.editId = '';
        if (selectCuotaCategoria) selectCuotaCategoria.value = "";
    }
    if (btnCancelarEdicionCuota) btnCancelarEdicionCuota.addEventListener('click', resetFormCuota);

    // --- MODAL DE PAGO GENÉRICO ---
    const modalPagoGenerico = document.getElementById('modal-pago-generico');
    const modalPagoTitulo = document.getElementById('modal-pago-titulo');
    const modalPagoDescripcion = document.getElementById('modal-pago-descripcion');
    const contMontoReal = document.getElementById('cont-monto-real');
    const inputMontoReal = document.getElementById('pago-monto-real');
    const formPagoGenerico = document.getElementById('form-pago-generico');
    const btnConfirmarPagoGenerico = document.getElementById('btn-confirmar-pago-generico');
    const btnCerrarPagoGenerico = document.getElementById('btn-cerrar-pago-generico');
    let pagoGenericoCallback = null;

    function abrirModalPagoGenerico({ titulo, descripcion, monto, necesitaMontoReal, callback }) {
        modalPagoTitulo.textContent = titulo;
        modalPagoDescripcion.textContent = descripcion;
        inputMontoReal.value = monto || '';
        contMontoReal.style.display = necesitaMontoReal ? 'block' : 'none';
        formPagoGenerico.reset(); // Limpia el input de archivo
        pagoGenericoCallback = callback;
        modalPagoGenerico.style.display = 'flex';
        setTimeout(() => modalPagoGenerico.style.opacity = '1', 10);
    }

    if (modalPagoGenerico) {
        btnCerrarPagoGenerico.addEventListener('click', () => {
            modalPagoGenerico.style.opacity = '0';
            setTimeout(() => modalPagoGenerico.style.display = 'none', 200);
        });
        btnConfirmarPagoGenerico.addEventListener('click', () => {
            if (pagoGenericoCallback) pagoGenericoCallback();
        });
    }


    // --- 6. DELEGACIÓN DE EVENTOS ---

    /**
     * REFACTORIZACIÓN: Usamos un "Mapa de Acciones" para la delegación de eventos.
     * Esto es más limpio y escalable que múltiples if/else.
     */
    const accionesRecurrentes = {
        'btn-tarjeta': (target) => {
            abrirModalTarjeta(target.dataset.id, target.dataset.desc);
        },
        'btn-pagar': (target) => {
            const { id, monto, desc, tipo, moneda } = target.dataset;
            abrirModalPagoGenerico({
                titulo: `Pagar: ${desc}`,
                descripcion: `Monto estimado: ${formatearMoneda(monto, moneda)}. Ingresa el monto real pagado.`,
                monto: monto,
                necesitaMontoReal: true,
                callback: async () => {
                    const formData = new FormData(formPagoGenerico);
                    formData.append('recurrente_id', id);
                    formData.append('monto_pagado', inputMontoReal.value);
                    await apiCall('/api/recurrente/pagar', 'POST', formData);
                    mostrarMensaje(`¡Pago procesado!`);
                    btnCerrarPagoGenerico.click();
                    refrescarPaneles();
                }
            });
        },
        'btn-cobrar': (target) => {
            const { id, monto, desc, tipo, moneda } = target.dataset;
            // FIX: Reutilizamos la misma lógica de 'btn-pagar' ya que el endpoint es el mismo.
            // Se pasa el 'target' para que la función 'btn-pagar' tenga acceso a los datos.
            accionesRecurrentes['btn-pagar'](target);
        },
        'btn-omitir': async (target) => {
            if (confirm(`¿Omitir "${target.dataset.desc}" este mes?`)) {
                const d = await apiCall('/api/recurrente/omitir', 'POST', { recurrente_id: target.dataset.id });
                mostrarMensaje(d.mensaje);
                refrescarPaneles();
            }
        },
        'btn-historial': (target) => {
            abrirModalHistorial(target.dataset.id);
        },
        'btn-eliminar-recurrente': async (target) => {
            if (confirm(`¿Seguro que quieres eliminar "${target.dataset.desc}"? Esta acción no se puede deshacer.`)) {
                await apiCall(`/api/recurrente/${target.dataset.id}`, 'DELETE');
                mostrarMensaje("Recurrente eliminado.");
                refrescarPaneles();
            }
        },
        'btn-editar-recurrente': (target) => {
            const data = JSON.parse(target.dataset.json);
            formRecurrente.dataset.editId = data.id;
            document.getElementById('recurrente-descripcion').value = data.descripcion;
            document.getElementById('recurrente-monto').value = data.monto_estimado;
            document.getElementById('recurrente-dia').value = data.dia_vencimiento;
            document.getElementById('recurrente-categoria').value = data.categoria_id;
            document.getElementById('recurrente-observacion').value = data.observacion || '';
            if (document.getElementById('recurrente-moneda')) document.getElementById('recurrente-moneda').value = data.moneda || 'ARS';
            if (document.getElementById('recurrente-tipo')) document.getElementById('recurrente-tipo').value = data.tipo || 'gasto';

            formRecurrenteTitulo.textContent = 'Editar Gasto Recurrente';
            btnSubmitRecurrente.textContent = 'Actualizar';
            btnCancelarEdicion.style.display = 'block';
            formRecurrente.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const accionesCuotas = {
        'btn-pagar-cuota': (target) => {
            const { id, monto, moneda, desc } = target.dataset;
            abrirModalPagoGenerico({
                titulo: `Pagar Cuota: ${desc}`,
                descripcion: `Confirmas el pago de la cuota por ${formatearMoneda(monto, moneda)}.`,
                monto: monto,
                necesitaMontoReal: false,
                callback: async () => {
                    const formData = new FormData(formPagoGenerico);
                    formData.append('plan_id', id);
                    formData.append('cantidad_cuotas', 1);
                    await apiCall('/api/cuota/pagar', 'POST', formData);
                    mostrarMensaje("Cuota pagada.");
                    btnCerrarPagoGenerico.click();
                    refrescarPaneles();
                }
            });
        },
        'btn-editar-cuota': (target) => {
            const data = JSON.parse(target.dataset.json);
            formCuota.dataset.editId = data.id;
            document.getElementById('cuota-descripcion').value = data.descripcion;
            document.getElementById('cuota-total').value = data.monto_total;
            document.getElementById('cuota-monto').value = data.monto_cuota;
            document.getElementById('cuota-total-cuotas').value = data.total_cuotas;
            document.getElementById('cuota-categoria').value = data.categoria_id;
            document.getElementById('cuota-fecha-inicio').value = data.fecha_inicio;
            if (document.getElementById('cuota-moneda')) document.getElementById('cuota-moneda').value = data.moneda || 'ARS';
            if (selectCuotaRecurrente) selectCuotaRecurrente.value = data.recurrente_id || "";

            formCuotaTitulo.textContent = 'Editar Plan';
            btnSubmitCuota.textContent = 'Actualizar';
            if (btnCancelarEdicionCuota) btnCancelarEdicionCuota.style.display = 'block';
            formCuota.scrollIntoView({ behavior: 'smooth' });
        },
        'btn-eliminar-cuota': async (target) => {
            if (confirm('¿Eliminar este plan de cuotas?')) {
                await apiCall(`/api/cuota/${target.dataset.id}`, 'DELETE');
                mostrarMensaje("Plan de cuotas eliminado.");
                refrescarPaneles();
            }
        }
    };

    const accionesTransacciones = {
        'btn-eliminar-transaccion': async (target) => {
            if (confirm('¿Seguro que quieres eliminar este movimiento? Esta acción no se puede deshacer.')) {
                try {
                    await apiCall(`/api/transaccion/${target.dataset.id}`, 'DELETE');
                    mostrarMensaje("Movimiento eliminado.");
                    refrescarPaneles(); // Refresca todos los paneles para reflejar el cambio
                } catch (error) { /* El error ya es manejado por apiCall */ }
            }
        }
    };

    function manejarClickEnTabla(e, mapaDeAcciones) {
        const target = e.target.closest('button, [class*="btn-"]');
        if (!target) return;

        const accion = Object.keys(mapaDeAcciones).find(clase => target.classList.contains(clase));
        if (accion) {
            e.preventDefault();
            mapaDeAcciones[accion](target);
        }
    }

    if (tablaRecurrentesBody) {
        tablaRecurrentesBody.addEventListener('click', (e) => manejarClickEnTabla(e, accionesRecurrentes));
    }

    if (tablaCuotasBody) {
        tablaCuotasBody.addEventListener('click', (e) => manejarClickEnTabla(e, accionesCuotas));
    }

    if (tablaBody) {
        tablaBody.addEventListener('click', (e) => manejarClickEnTabla(e, accionesTransacciones));
    }

    // --- 7. MODALES (TARJETA Y HISTORIAL) ---
    const modalTarjeta = document.getElementById('modal-tarjeta');
    const modalTarjetaTitulo = document.getElementById('modal-tarjeta-titulo');
    const formPagoTarjeta = document.getElementById('form-pago-tarjeta');
    const loadingTarjeta = document.getElementById('modal-tarjeta-loading');
    const btnCerrarModalTarjeta = document.getElementById('btn-cerrar-modal-tarjeta');
    const btnConfirmarPagoResumen = document.getElementById('btn-confirmar-pago-resumen');

    async function abrirModalTarjeta(idRecurrente, nombreTarjeta) {
        modalTarjeta.style.display = 'flex';
        setTimeout(() => modalTarjeta.style.opacity = '1', 10);
        modalTarjetaTitulo.textContent = `Pagar Resumen: ${nombreTarjeta}`;
        document.getElementById('tarjeta-recurrente-id').value = idRecurrente;
        formPagoTarjeta.style.display = 'none'; loadingTarjeta.style.display = 'block';

        const divListaCuotas = document.getElementById('lista-cuotas-tarjeta');
        const spanTotalCuotas = document.getElementById('total-cuotas-modal');
        const inputMontoPagado = document.getElementById('monto-pagado-resumen');
        divListaCuotas.innerHTML = '';
        spanTotalCuotas.textContent = formatearMoneda(0);
        inputMontoPagado.value = '';

        try {
            const data = await apiCall('/api/cuotas/status');
            loadingTarjeta.style.display = 'none'; formPagoTarjeta.style.display = 'block';
            
            const pendientes = data.filter(p => p.status_mes.includes('Pendiente') && p.recurrente_id == idRecurrente);
            let totalCuotas = 0;

            if (pendientes.length === 0) {
                divListaCuotas.innerHTML = '<p class="no-cuotas">No hay cuotas pendientes para este resumen.</p>';
            } else {
                pendientes.forEach(p => {
                    totalCuotas += p.monto_cuota;
                    const div = document.createElement('div');
                    div.className = 'cuota-item-info'; // Nueva clase para solo mostrar info
                    div.innerHTML = `<strong>${p.descripcion}</strong> (${p.cuota_actual + 1}/${p.total_cuotas}) <span class="monto">${formatearMoneda(p.monto_cuota, p.moneda)}</span>`;
                    divListaCuotas.appendChild(div);
                });
            }
            
            spanTotalCuotas.textContent = formatearMoneda(totalCuotas, pendientes[0]?.moneda || 'ARS');
            inputMontoPagado.value = totalCuotas.toFixed(2); // Sugerimos el monto total de cuotas

        } catch (error) {
            console.error("Error al abrir modal de tarjeta:", error);
            loadingTarjeta.style.display = 'none';
            divListaCuotas.innerHTML = '<p style="color:red">Error al cargar las cuotas.</p>';
        }
    }

    if (modalTarjeta) {
        if(btnCerrarModalTarjeta) btnCerrarModalTarjeta.addEventListener('click', () => { modalTarjeta.style.opacity='0'; setTimeout(()=>modalTarjeta.style.display='none',200); });

        btnConfirmarPagoResumen.addEventListener('click', async () => {
            if (parseFloat(document.getElementById('monto-pagado-resumen').value) < 0) {
                return alert("El monto pagado debe ser mayor a cero.");
            }
            
            const formData = new FormData(formPagoTarjeta);
            // Añadimos el ID del recurrente y el monto pagado que no están en el form directamente
            formData.append('recurrente_id', document.getElementById('tarjeta-recurrente-id').value);
            formData.append('monto_pagado', document.getElementById('monto-pagado-resumen').value);
            if (confirm(`¿Confirmas el pago del resumen?`)) {
                try {
                    const d = await apiCall('/api/tarjeta/pagar-resumen', 'POST', formData);
                    mostrarMensaje(d.mensaje);
                    modalTarjeta.style.opacity='0'; setTimeout(()=>modalTarjeta.style.display='none',200);
                    refrescarPaneles();
                } catch (error) {
                    // El error ya es mostrado por apiCall, aquí no necesitamos hacer nada más.
                    console.error("Fallo al pagar resumen:", error);
                }
            }
        });
    }

    function abrirModalHistorial(id) {
        if(!modalHistorial) return;
        modalHistorial.style.display = 'flex'; setTimeout(() => modalHistorial.style.opacity = '1', 10);
        loadingHistorial.style.display = 'block'; tbodyHistorial.innerHTML = '';

        fetch(`/api/recurrente/historial/${id}`).then(r => r.json()).then(data => {
            loadingHistorial.style.display = 'none';
            if(data.length === 0) { tbodyHistorial.innerHTML = '<tr><td colspan="2">Sin movimientos.</td></tr>'; return; }
            data.forEach(h => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td style="padding:8px; border-bottom:1px solid #eee;">${h.fecha}</td><td style="padding:8px; border-bottom:1px solid #eee;">${formatearMoneda(h.monto, h.moneda)}</td>`;
                tbodyHistorial.appendChild(tr);
            });
        });
    }
    if(btnCerrarHistorial) btnCerrarHistorial.addEventListener('click', () => { modalHistorial.style.opacity='0'; setTimeout(()=>modalHistorial.style.display='none',200); });

    // --- 8. INICIO Y CONFIGURACIÓN DE EVENTOS ---

    // Función para refrescar todos los paneles principales
    function refrescarPaneles() {
        cargarTransacciones();
        cargarRecurrentesStatus();
        cargarDashboardSummary();
        cargarCuotasStatus();
    }
    
    async function inicializarApp() {
        await cargarCategorias(); // Esperamos a que las categorías se carguen primero
        refrescarPaneles();

        // FIX: Añadimos los listeners para los formularios que se perdieron en la refactorización.
        if (formTransaccion) {
            formTransaccion.addEventListener('submit', (e) => {
                e.preventDefault();
                handleFormSubmit(formTransaccion, () => {
                    formTransaccion.reset();
                    if (selectCategoria) selectCategoria.value = ""; // Aseguramos el default
                    refrescarPaneles();
                });
            });
        }
        if (formRecurrente) {
            formRecurrente.addEventListener('submit', (e) => { e.preventDefault(); handleFormSubmit(formRecurrente, () => { resetFormRecurrente(); refrescarPaneles(); }); });
        }
        if (formCuota) {
            formCuota.addEventListener('submit', (e) => { e.preventDefault(); handleFormSubmit(formCuota, () => { resetFormCuota(); refrescarPaneles(); }); });
        }

        // --- Funcionalidad extra: Crear tarjeta desde el form de cuotas ---
        if (selectCuotaRecurrente) {
            selectCuotaRecurrente.addEventListener('change', async (e) => {
                if (e.target.value === 'nueva_tarjeta') {
                    const nombreTarjeta = prompt("Ingresa el nombre para la nueva tarjeta (ej: Visa Banco X):");
                    if (nombreTarjeta) {
                        // Usamos una categoría por defecto o la primera que encontremos.
                        const categoriaId = document.querySelector('#recurrente-categoria option:nth-child(2)')?.value;
                        if (!categoriaId) {
                            alert("No se encontraron categorías para asignar a la tarjeta. Por favor, crea una categoría primero.");
                            selectCuotaRecurrente.value = ""; // Reseteamos la selección
                            return;
                        }
                        // FIX: Usamos FormData para enviar los datos, ya que el endpoint lo espera así.
                        const formData = new FormData();
                        formData.append('descripcion', nombreTarjeta);
                        formData.append('monto_estimado', "0");
                        formData.append('dia_vencimiento', "1");
                        formData.append('tipo', 'tarjeta');
                        formData.append('categoria_id', categoriaId);
                        formData.append('moneda', 'ARS');

                        const d = await apiCall('/api/recurrente', 'POST', formData);
                        await cargarRecurrentesStatus(); // Recarga la lista de tarjetas y actualiza el select
                        selectCuotaRecurrente.value = d.id; // Selecciona la tarjeta recién creada
                    } else {
                        selectCuotaRecurrente.value = ""; // Si cancela, reseteamos la selección
                    }
                }
            });
        }

        // --- Funcionalidad extra: Auto-cálculo de cuotas ---
        const inputCuotaTotal = document.getElementById('cuota-total');
        const inputCuotaTotalCuotas = document.getElementById('cuota-total-cuotas');
        const inputCuotaMonto = document.getElementById('cuota-monto');

        function autoCalcularCuota() {
            const total = parseFloat(inputCuotaTotal.value);
            const numCuotas = parseInt(inputCuotaTotalCuotas.value, 10);
            if (total > 0 && numCuotas > 0) {
                inputCuotaMonto.value = (total / numCuotas).toFixed(2);
            }
        }

        inputCuotaTotal.addEventListener('input', autoCalcularCuota);
        inputCuotaTotalCuotas.addEventListener('input', autoCalcularCuota);

        // --- Funcionalidad extra: Crear categoría desde un botón ---
        async function handleCrearCategoria(selectAsociado) {
            const nombreCategoria = prompt("Ingresa el nombre para la nueva categoría:");
            if (nombreCategoria) {
                try {
                    const nuevaCat = await apiCall('/api/categoria', 'POST', { nombre: nombreCategoria });
                    await cargarCategorias(); // Recarga todas las listas de categorías
                    if (selectAsociado) {
                        selectAsociado.value = nuevaCat.id; // Selecciona la categoría recién creada en el combo correspondiente
                    }
                } catch (error) {
                    // El error ya es manejado por apiCall
                }
            }
        }

        // Asignamos el evento a cada botón de "crear categoría"
        document.getElementById('btn-crear-categoria-transaccion')?.addEventListener('click', () => handleCrearCategoria(selectCategoria));
        document.getElementById('btn-crear-categoria-recurrente')?.addEventListener('click', () => handleCrearCategoria(selectRecurrenteCategoria));
        document.getElementById('btn-crear-categoria-cuota')?.addEventListener('click', () => handleCrearCategoria(selectCuotaCategoria));

        // --- Funcionalidad extra: Registro de dispositivo WebAuthn ---
        const btnWebAuthnRegister = document.getElementById('btn-webauthn-register');
        if (btnWebAuthnRegister) {
            // Solo mostramos el botón si el navegador es compatible
            if (!window.PublicKeyCredential) {
                btnWebAuthnRegister.style.display = 'none';
            }

            btnWebAuthnRegister.addEventListener('click', async () => {
                try {
                    // Funciones auxiliares para convertir formatos
                    const bufferDecode = (value) => Uint8Array.from(atob(value.replace(/_/g, '/').replace(/-/g, '+')), c => c.charCodeAt(0));
                    const bufferEncode = (value) => btoa(String.fromCharCode.apply(null, new Uint8Array(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

                    // 1. Pedir opciones de registro al servidor
                    const respBegin = await fetch('/api/webauthn/register-begin', { method: 'POST' });
                    let options = await respBegin.json();

                    // 2. Convertir los campos necesarios a ArrayBuffer
                    options.challenge = bufferDecode(options.challenge);
                    options.user.id = bufferDecode(options.user.id);
                    if (options.excludeCredentials) {
                        options.excludeCredentials.forEach(cred => {
                            cred.id = bufferDecode(cred.id);
                        });
                    }

                    // 3. Pedir al navegador que cree la credencial (esto activa la biometría)
                    const credential = await navigator.credentials.create({ publicKey: options });

                    // 4. Convertir la respuesta para poder enviarla como JSON
                    const credentialJSON = {
                        id: credential.id,
                        rawId: bufferEncode(credential.rawId),
                        response: {
                            clientDataJSON: bufferEncode(credential.response.clientDataJSON),
                            attestationObject: bufferEncode(credential.response.attestationObject),
                        },
                        type: credential.type,
                    };

                    // 5. Enviar la nueva credencial al servidor para guardarla
                    const respComplete = await fetch('/api/webauthn/register-complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentialJSON) });
                    const verification = await respComplete.json();
                    alert(verification.mensaje || verification.error);

                } catch (err) {
                    console.error("Error durante el registro biométrico:", err);
                    alert("No se pudo registrar el dispositivo. " + err.message);
                }
            });
        }

        // --- Funcionalidad extra: Cerrar modales con la tecla 'Escape' ---
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Reutilizamos la lógica de los botones de cierre para mantener la consistencia
                if (modalTarjeta && modalTarjeta.style.display === 'flex') {
                    btnCerrarModalTarjeta.click();
                }
                if (modalHistorial && modalHistorial.style.display === 'flex') {
                    btnCerrarHistorial.click();
                }
                if (modalPagoGenerico && modalPagoGenerico.style.display === 'flex') {
                    btnCerrarPagoGenerico.click();
                }
            }
        });

        // --- Funcionalidad extra: Timeout por inactividad ---
        let inactivityTimer;
        const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos en milisegundos

        function logoutUser() {
            window.location.href = '/logout';
        }

        function resetInactivityTimer() {
            clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(logoutUser, INACTIVITY_TIMEOUT);
        }

        // Resetea el temporizador con cualquier actividad del usuario
        window.addEventListener('mousemove', resetInactivityTimer);
        window.addEventListener('keydown', resetInactivityTimer);
        window.addEventListener('click', resetInactivityTimer);
        resetInactivityTimer(); // Inicia el temporizador al cargar la página
    }

    inicializarApp();
});