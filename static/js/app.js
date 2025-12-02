document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Cargado. Ejecutando app.js v12 (Multimoneda + Historial + Omitir)...");

    // --- 1. SELECTORES ---
    const apiStatusDiv = document.getElementById('api-status');
    
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
        const options = {
            method,
            headers: { 'Content-Type': 'application/json' },
        };
        if (body) {
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
            [selectCategoria, selectRecurrenteCategoria, selectCuotaCategoria].forEach(sel => sel.innerHTML = '');
            const def = new Option("-- Seleccionar --", "");
            selectCategoria.appendChild(new Option("-- Sin Categoría --", ""));
            selectRecurrenteCategoria.appendChild(def.cloneNode(true));
            selectCuotaCategoria.appendChild(def.cloneNode(true));
            data.forEach(c => {
                const option = new Option(c.nombre, c.id);
                selectCategoria.appendChild(option.cloneNode(true));
                selectRecurrenteCategoria.appendChild(option.cloneNode(true));
                selectCuotaCategoria.appendChild(option.cloneNode(true));
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
        return `
            <tr>
                <td>${f[2]}/${f[1]}/${f[0]}</td> <td>${t.descripcion}</td>
                <td>${t.categoria_nombre || 'N/A'}</td> <td>${t.tipo}</td>
                <td style="color:${color}">${t.tipo === 'gasto' ? '-' : '+'}${formatearMoneda(t.monto, mon)}</td>
            </tr>`;
    }

    function actualizarSelectTarjetas() {
        if (!selectCuotaRecurrente) return;
        const valorActual = selectCuotaRecurrente.value;
        selectCuotaRecurrente.innerHTML = '<option value="">-- Ninguna --</option>';
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
                <td>${r.descripcion} ${obsIcon} ${histIcon}</td>
                <td>${r.categoria_nombre}</td>
                <td>Día ${r.dia_vencimiento}</td>
                <td>${formatearMoneda(r.monto_estimado, mon)}</td>
                <td style="${estadoEstilo}">${r.status}</td>
                <td>
                    ${btn}
                    <button class="btn-accion btn-editar-recurrente" data-json="${jsonData}">✏️</button>
                    <button class="btn-accion btn-eliminar-recurrente" data-id="${r.id}" data-desc="${r.descripcion}">❌</button>
                </td>
            </tr>`;
    }

    function crearFilaCuota(p) {
        const estilo = p.status_mes.includes('Pagado') ? 'color: green;' : 'color: orange;';
        const mon = p.moneda || 'ARS';
        let btn = '';
        if (p.status_mes.includes('Pendiente')) {
            btn = `<button class="btn-pagar-cuota" data-id="${p.id}" data-monto="${p.monto_cuota}" data-moneda="${mon}" data-desc="${p.descripcion}" data-restantes="${p.total_cuotas - p.cuota_actual}">Pagar ${mon}</button>`;
        } else {
            btn = '<span class="text-success">Listo</span>';
        }
        const jsonData = JSON.stringify(p).replace(/"/g, '&quot;');
        return `
            <tr>
                <td>${p.descripcion}</td> <td>${p.categoria_nombre}</td>
                <td>${p.cuota_actual}/${p.total_cuotas}</td>
                <td>${formatearMoneda(p.monto_cuota, mon)}</td>
                <td style="${estilo}">${p.status_mes}</td>
                <td>${btn} <button class="btn-accion btn-editar-cuota" data-json="${jsonData}">✏️</button> <button class="btn-accion btn-eliminar-cuota" data-id="${p.id}">❌</button></td>
            </tr>`;
    }

    // --- 5. MANEJO DE FORMULARIOS ---

    /**
     * REFACTORIZACIÓN: Función genérica para manejar el envío de formularios.
     * @param {HTMLFormElement} form - El formulario a manejar.
     * @param {function} onSucess - Callback a ejecutar tras el éxito.
     */
    async function handleFormSubmit(form, onSuccess) {
        const datos = Object.fromEntries(new FormData(form).entries());
        const id = form.dataset.editId;
        const endpoint = id ? `${form.dataset.endpoint}/${id}` : form.dataset.endpoint;
        const method = id ? 'PUT' : 'POST';

        try {
            const d = await apiCall(endpoint, method, datos);
            mostrarMensaje(d.mensaje);
            onSuccess();
        } catch (error) {
            console.error("Error en el formulario:", error);
        }
    }

    function resetFormRecurrente() {
        formRecurrente.reset();
        formRecurrenteTitulo.textContent = 'Definir Gasto Recurrente';
        btnSubmitRecurrente.textContent = 'Guardar Recurrente';
        btnCancelarEdicion.style.display = 'none';
        formRecurrente.dataset.editId = '';
    }
    if(btnCancelarEdicion) btnCancelarEdicion.addEventListener('click', resetFormRecurrente);

    function resetFormCuota() {
        formCuota.reset();
        formCuotaTitulo.textContent = 'Definir Plan de Cuotas';
        btnSubmitCuota.textContent = 'Guardar Plan';
        if(btnCancelarEdicionCuota) btnCancelarEdicionCuota.style.display = 'none';
        formCuota.dataset.editId = '';
    }
    if (btnCancelarEdicionCuota) btnCancelarEdicionCuota.addEventListener('click', resetFormCuota);

    // --- 6. DELEGACIÓN DE EVENTOS ---

    // --- 7. MODALES (TARJETA Y HISTORIAL) ---
    const modalTarjeta = document.getElementById('modal-tarjeta');
    const modalTarjetaTitulo = document.getElementById('modal-tarjeta-titulo');
    const formPagoTarjeta = document.getElementById('form-pago-tarjeta');
    const loadingTarjeta = document.getElementById('modal-tarjeta-loading');
    const btnCerrarModalTarjeta = document.getElementById('btn-cerrar-modal-tarjeta');

    function abrirModalTarjeta(idRecurrente, nombreTarjeta) {
        modalTarjeta.style.display = 'flex';
        setTimeout(() => modalTarjeta.style.opacity = '1', 10);
        modalTarjetaTitulo.textContent = `Pagar Resumen: ${nombreTarjeta}`;
        document.getElementById('tarjeta-recurrente-id').value = idRecurrente;
        formPagoTarjeta.style.display = 'none'; loadingTarjeta.style.display = 'block';

        // Limpiar contenedores
        ['ars', 'usd'].forEach(moneda => {
            document.getElementById(`lista-cuotas-tarjeta-${moneda}`).innerHTML = '';
            document.querySelector(`.tarjeta-otros-consumos[data-moneda="${moneda.toUpperCase()}"]`).value = 0;
        });

        fetch('/api/cuotas/status').then(r => r.json()).then(data => {
            loadingTarjeta.style.display = 'none'; formPagoTarjeta.style.display = 'block';
            
            const pendientes = data.filter(p => p.status_mes.includes('Pendiente') && p.recurrente_id == idRecurrente);            
            const cuotasPorMoneda = { ARS: [], USD: [] };
            pendientes.forEach(p => {
                const moneda = p.moneda || 'ARS';
                cuotasPorMoneda[moneda].push(p);
            });

            ['ARS', 'USD'].forEach(moneda => {
                const divListaCuotas = document.getElementById(`lista-cuotas-tarjeta-${moneda.toLowerCase()}`);
                const columna = document.getElementById(`resumen-${moneda.toLowerCase()}`);
                
                if (cuotasPorMoneda[moneda].length === 0) {
                    divListaCuotas.innerHTML = '<p class="no-cuotas">No hay cuotas pendientes.</p>';
                } else {
                    cuotasPorMoneda[moneda].forEach(p => {
                    const div = document.createElement('div');
                    div.className = 'cuota-item';
                    div.innerHTML = `<label>
                        <input type="checkbox" class="check-cuota" value="${p.id}" data-monto="${p.monto_cuota}" data-moneda="${moneda}" checked>
                        <div><strong>${p.descripcion}</strong> <br> <small>${p.cuota_actual}/${p.total_cuotas} - ${formatearMoneda(p.monto_cuota, p.moneda)}</small></div>
                    </label>`;
                    divListaCuotas.appendChild(div);
                    });
                }
                // Ocultar toda la columna si no hay cuotas Y el campo "otros" está en 0 (se recalcula al abrir)
                calcularTotalTarjeta(moneda);
            });
        });
    }

    function calcularTotalTarjeta(moneda) {
        let total = 0;
        document.querySelectorAll(`.check-cuota[data-moneda="${moneda}"]:checked`).forEach(chk => total += parseFloat(chk.dataset.monto));
        
        const otrosInput = document.querySelector(`.tarjeta-otros-consumos[data-moneda="${moneda}"]`);
        total += parseFloat(otrosInput.value) || 0;

        document.querySelector(`.tarjeta-total-pagar[data-moneda="${moneda}"]`).textContent = formatearMoneda(total, moneda);
        
        // Lógica para ocultar/mostrar la columna
        const columna = document.getElementById(`resumen-${moneda.toLowerCase()}`);
        const hayCuotas = document.querySelectorAll(`.check-cuota[data-moneda="${moneda}"]`).length > 0;
        if (!hayCuotas && total <= 0) {
            columna.style.display = 'none';
        } else {
            columna.style.display = 'block';
        }
        return total;
    }

    if (modalTarjeta) {
        // Usamos el formulario como contenedor para delegar eventos
        formPagoTarjeta.addEventListener('input', (e) => {
            if (e.target.classList.contains('check-cuota') || e.target.classList.contains('tarjeta-otros-consumos')) {
                calcularTotalTarjeta(e.target.dataset.moneda);
            }
        });

        if(btnCerrarModalTarjeta) btnCerrarModalTarjeta.addEventListener('click', () => { modalTarjeta.style.opacity='0'; setTimeout(()=>modalTarjeta.style.display='none',200); });

        formPagoTarjeta.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-pagar-resumen')) {
                e.preventDefault();
                const moneda = e.target.dataset.moneda;
                const recurrenteId = document.getElementById('tarjeta-recurrente-id').value;
                const planesIds = Array.from(document.querySelectorAll(`.check-cuota[data-moneda="${moneda}"]:checked`)).map(c => c.value);
                const montoOtros = document.querySelector(`.tarjeta-otros-consumos[data-moneda="${moneda}"]`).value;
                const total = calcularTotalTarjeta(moneda);
                
                if(total <= 0) return alert(`El monto a pagar en ${moneda} debe ser mayor a 0.`);
                if(!confirm(`¿Confirmas el pago del resumen en ${moneda} por un total de ${formatearMoneda(total, moneda)}?`)) return;

                fetch('/api/tarjeta/pagar-resumen', {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ recurrente_id: recurrenteId, planes_ids: planesIds, monto_otros: montoOtros, monto_total: total, moneda: moneda })
                }).then(r => r.json()).then(d => {
                    if(d.error) throw new Error(d.error); mostrarMensaje(d.mensaje);
                    modalTarjeta.style.opacity='0'; setTimeout(()=>modalTarjeta.style.display='none',200);
                    cargarRecurrentesStatus(); cargarTransacciones(); cargarDashboardSummary(); cargarCuotasStatus();
                }).catch(e => alert(e.message));
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
    
    function inicializarApp() {
        cargarCategorias();
        cargarTransacciones();
        cargarRecurrentesStatus();
        cargarDashboardSummary();
        cargarCuotasStatus();
    }

    inicializarApp();
});