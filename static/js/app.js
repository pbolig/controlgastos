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

    async function mostrarConfirmacion(texto) {
        return new Promise((resolve) => {
            if(confirm(texto)) resolve(true); else resolve(false);
        });
    }

    function formatearMoneda(numero, moneda = 'ARS') {
        const num = parseFloat(numero);
        if (isNaN(num)) return "$0.00";
        let currencyCode = 'ARS';
        if (moneda === 'USD') currencyCode = 'USD';
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: currencyCode }).format(num);
    }

    // --- 3. CARGA INICIAL ---

    fetch('/api/test').then(r => r.json()).then(data => {
        if (apiStatusDiv) apiStatusDiv.innerHTML = `<p style="color: green;">${data.mensaje}</p>`;
    }).catch(err => console.error(err));

    function cargarCategorias() {
        fetch('/api/categorias').then(r => r.json()).then(data => {
            [selectCategoria, selectRecurrenteCategoria, selectCuotaCategoria].forEach(sel => sel.innerHTML = '');
            const def = new Option("-- Seleccionar --", "");
            selectCategoria.appendChild(new Option("-- Sin Categoría --", ""));
            selectRecurrenteCategoria.appendChild(def.cloneNode(true));
            selectCuotaCategoria.appendChild(def.cloneNode(true));
            data.forEach(c => {
                selectCategoria.appendChild(new Option(c.nombre, c.id));
                selectRecurrenteCategoria.appendChild(new Option(c.nombre, c.id));
                selectCuotaCategoria.appendChild(new Option(c.nombre, c.id));
            });
        });
    }

    // --- 4. TRANSACCIONES ---

    if (formTransaccion) {
        formTransaccion.addEventListener('submit', (e) => {
            e.preventDefault();
            const datos = Object.fromEntries(new FormData(formTransaccion).entries());
            fetch('/api/transaccion', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) })
            .then(r => r.json()).then(d => {
                if (d.error) throw new Error(d.error);
                mostrarMensaje(`¡${d.mensaje}!`);
                formTransaccion.reset();
                cargarTransacciones(); cargarDashboardSummary();
            }).catch(e => alert(e.message));
        });
    }

    function cargarTransacciones() {
        if(!tablaBody) return;
        fetch('/api/transacciones').then(r => r.json()).then(data => {
            tablaBody.innerHTML = '';
            data.forEach(t => {
                const tr = document.createElement('tr');
                const color = t.tipo === 'gasto' ? 'red' : 'green';
                const f = t.fecha.split('-');
                const mon = t.moneda || 'ARS';
                tr.innerHTML = `
                    <td>${f[2]}/${f[1]}/${f[0]}</td> <td>${t.descripcion}</td>
                    <td>${t.categoria_nombre || 'N/A'}</td> <td>${t.tipo}</td>
                    <td style="color:${color}">${t.tipo==='gasto'?'-':'+'}${formatearMoneda(t.monto, mon)}</td>
                `;
                tablaBody.appendChild(tr);
            });
        });
    }

    // --- 5. RECURRENTES (CRUD + OMITIR + HISTORIAL + TARJETA) ---

    function resetFormRecurrente() {
        formRecurrente.reset();
        formRecurrenteTitulo.textContent = 'Definir Gasto Recurrente';
        btnSubmitRecurrente.textContent = 'Guardar Recurrente';
        btnCancelarEdicion.style.display = 'none';
        formRecurrente.dataset.editId = '';
    }
    if(btnCancelarEdicion) btnCancelarEdicion.addEventListener('click', resetFormRecurrente);

    if (formRecurrente) {
        formRecurrente.addEventListener('submit', (e) => {
            e.preventDefault();
            const datos = Object.fromEntries(new FormData(formRecurrente).entries());
            const id = formRecurrente.dataset.editId;
            const url = id ? `/api/recurrente/${id}` : '/api/recurrente';
            const method = id ? 'PUT' : 'POST';

            fetch(url, { method: method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) })
            .then(r => r.json()).then(d => {
                if (d.error) throw new Error(d.error);
                mostrarMensaje(d.mensaje);
                resetFormRecurrente();
                cargarRecurrentesStatus(); cargarDashboardSummary();
            }).catch(e => alert(e.message));
        });
    }

    function cargarRecurrentesStatus() {
        if(!tablaRecurrentesBody) return;
        fetch('/api/recurrentes/status').then(r => r.json()).then(data => {
            tablaRecurrentesBody.innerHTML = '';
            // Guardar tarjetas para el combo de cuotas
            tarjetasDisponibles = data.filter(r => r.tipo === 'tarjeta');
            actualizarSelectTarjetas();

            if (data.length === 0) return tablaRecurrentesBody.innerHTML = '<tr><td colspan="6">No hay datos.</td></tr>';

            data.forEach(r => {
                const tr = document.createElement('tr');
                const procesado = r.status === 'Procesado' || r.status === 'Pagado';
                let estadoEstilo = 'color: orange;';
                if (procesado) estadoEstilo = 'color: green;';
                else if (r.status === 'Omitido') estadoEstilo = 'color: gray; font-style: italic;';
                
                const mon = r.moneda || 'ARS';

                let btn = '';
                if (r.status === 'Pendiente') {
                    if (r.tipo === 'tarjeta') {
                        // BOTÓN TARJETA
                        btn = `<button class="btn-tarjeta" data-id="${r.id}" data-desc="${r.descripcion}" style="background:#8e44ad; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer; margin-right:5px;">Resumen 💳</button>`;
                    } else {
                        // PAGAR / COBRAR
                        const txt = r.tipo === 'ingreso' ? 'Cobrar' : 'Pagar';
                        const cls = r.tipo === 'ingreso' ? 'btn-cobrar' : 'btn-pagar';
                        btn = `<button class="${cls}" data-id="${r.id}" data-monto="${r.monto_estimado}" data-desc="${r.descripcion}" data-tipo="${r.tipo}" data-moneda="${mon}" style="margin-right:5px;">${txt}</button>`;
                    }
                    // BOTÓN OMITIR
                    btn += `<button class="btn-omitir" data-id="${r.id}" data-desc="${r.descripcion}" title="Omitir este mes" style="background:#95a5a6; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">⏸</button>`;
                } else {
                    btn = `<span class="text-success">✔ ${r.status}</span>`;
                }
                
                // Íconos Extra
                const obsIcon = (r.observacion && r.observacion.trim()) ? ` <span class="obs-tooltip" title="${r.observacion}">ℹ️</span>` : '';
                const histIcon = `<span class="btn-historial" data-id="${r.id}" style="cursor:pointer; margin-left:5px; font-size:1.1em;" title="Ver historial">🕒</span>`;
                const jsonData = JSON.stringify(r).replace(/"/g, '&quot;');

                tr.innerHTML = `
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
                `;
                tablaRecurrentesBody.appendChild(tr);
            });
        });
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

    if (tablaRecurrentesBody) {
        tablaRecurrentesBody.addEventListener('click', (e) => {
            const target = e.target.closest('button') || e.target.closest('.btn-historial');
            if (!target) return;

            // 1. TARJETA
            if (target.classList.contains('btn-tarjeta')) {
                abrirModalTarjeta(target.dataset.id, target.dataset.desc);
            }
            // 2. PAGAR / COBRAR
            else if (target.classList.contains('btn-pagar') || target.classList.contains('btn-cobrar')) {
                const { id, monto, desc, tipo, moneda } = target.dataset;
                const accion = tipo === 'ingreso' ? 'cobro' : 'pago';
                const real = prompt(`Confirmar ${accion} de "${desc}".\nMonto real (${moneda}):`, monto);
                if(real) {
                    fetch('/api/recurrente/pagar', { method: 'POST', headers: {'Content-Type': 'application/json'}, 
                        body: JSON.stringify({ recurrente_id: id, monto_pagado: real, moneda_pago: moneda }) 
                    }).then(r => r.json()).then(d => {
                        if(d.error) throw new Error(d.error);
                        mostrarMensaje(`¡Éxito! ${d.mensaje}`);
                        cargarRecurrentesStatus(); cargarTransacciones(); cargarDashboardSummary();
                    }).catch(e => alert(e.message));
                }
            }
            // 3. OMITIR
            else if (target.classList.contains('btn-omitir')) {
                if(confirm(`¿Omitir "${target.dataset.desc}" este mes?`)) {
                    fetch('/api/recurrente/omitir', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ recurrente_id: target.dataset.id }) })
                    .then(r => r.json()).then(d => {
                        if(d.error) throw new Error(d.error); mostrarMensaje(d.mensaje); cargarRecurrentesStatus(); cargarDashboardSummary();
                    });
                }
            }
            // 4. HISTORIAL
            else if (target.classList.contains('btn-historial')) {
                abrirModalHistorial(target.dataset.id);
            }
            // 5. ELIMINAR
            else if (target.classList.contains('btn-eliminar-recurrente')) {
                if(confirm('¿Eliminar?')) {
                    fetch(`/api/recurrente/${target.dataset.id}`, { method: 'DELETE' }).then(r=>r.json()).then(d=>{
                        if(d.error) throw new Error(d.error); mostrarMensaje(d.mensaje); cargarRecurrentesStatus(); cargarDashboardSummary();
                    });
                }
            } 
            // 6. EDITAR
            else if (target.classList.contains('btn-editar-recurrente')) {
                const data = JSON.parse(target.dataset.json);
                document.getElementById('recurrente-descripcion').value = data.descripcion;
                document.getElementById('recurrente-monto').value = data.monto_estimado;
                document.getElementById('recurrente-dia').value = data.dia_vencimiento;
                document.getElementById('recurrente-categoria').value = data.categoria_id;
                document.getElementById('recurrente-observacion').value = data.observacion || '';
                if(document.getElementById('recurrente-moneda')) document.getElementById('recurrente-moneda').value = data.moneda || 'ARS';
                if(document.getElementById('recurrente-tipo')) document.getElementById('recurrente-tipo').value = data.tipo || 'gasto';

                formRecurrenteTitulo.textContent = 'Editar Gasto Recurrente';
                btnSubmitRecurrente.textContent = 'Actualizar';
                btnCancelarEdicion.style.display = 'block';
                formRecurrente.dataset.editId = data.id;
                formRecurrente.scrollIntoView({behavior:'smooth'});
            }
        });
    }

    // --- 6. CUOTAS ---
    function resetFormCuota() {
        formCuota.reset();
        formCuotaTitulo.textContent = 'Definir Plan de Cuotas';
        btnSubmitCuota.textContent = 'Guardar Plan';
        if(btnCancelarEdicionCuota) btnCancelarEdicionCuota.style.display = 'none';
        formCuota.dataset.editId = '';
    }
    if (btnCancelarEdicionCuota) btnCancelarEdicionCuota.addEventListener('click', resetFormCuota);

    if (formCuota) {
        formCuota.addEventListener('submit', (e) => {
            e.preventDefault();
            const datos = Object.fromEntries(new FormData(formCuota).entries());
            const id = formCuota.dataset.editId;
            const url = id ? `/api/cuota/${id}` : '/api/cuota';
            const method = id ? 'PUT' : 'POST';
            fetch(url, { method: method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) })
            .then(r => r.json()).then(d => {
                if(d.error) throw new Error(d.error);
                mostrarMensaje(d.mensaje); resetFormCuota(); cargarCuotasStatus(); cargarDashboardSummary();
            }).catch(e => alert(e.message));
        });
    }

    function cargarCuotasStatus() {
        if(!tablaCuotasBody) return;
        fetch('/api/cuotas/status').then(r => r.json()).then(data => {
            tablaCuotasBody.innerHTML = '';
            data.forEach(p => {
                const tr = document.createElement('tr');
                const estilo = p.status_mes.includes('Pagado') ? 'color: green;' : 'color: orange;';
                const mon = p.moneda || 'ARS';
                let btn = '';
                if (p.status_mes.includes('Pendiente')) {
                    btn = `<button class="btn-pagar-cuota" data-id="${p.id}" data-monto="${p.monto_cuota}" data-moneda="${mon}" data-desc="${p.descripcion}" data-restantes="${p.total_cuotas - p.cuota_actual}">Pagar</button>`;
                } else {
                    btn = '<span class="text-success">Listo</span>';
                }
                const jsonData = JSON.stringify(p).replace(/"/g, '&quot;');
                tr.innerHTML = `
                    <td>${p.descripcion}</td> <td>${p.categoria_nombre}</td>
                    <td>${p.cuota_actual}/${p.total_cuotas}</td>
                    <td>${formatearMoneda(p.monto_cuota, mon)}</td>
                    <td style="${estilo}">${p.status_mes}</td>
                    <td>${btn} <button class="btn-accion btn-editar-cuota" data-json="${jsonData}">✏️</button> <button class="btn-accion btn-eliminar-cuota" data-id="${p.id}">❌</button></td>
                `;
                tablaCuotasBody.appendChild(tr);
            });
        });
    }

    if(tablaCuotasBody) {
        tablaCuotasBody.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if(!target) return;

            if(target.classList.contains('btn-pagar-cuota')) {
                // FLEXIBILIDAD DE PAGO
                const { id, monto, moneda, desc, restantes } = target.dataset;
                const monedaPago = prompt(`Cuota: ${formatearMoneda(monto, moneda)}. (Restan: ${restantes})\n¿Moneda de pago? (ARS/USD)`, moneda);
                if(!monedaPago) return;
                
                const montoFinal = prompt(`Monto final en ${monedaPago.toUpperCase()}:`, monto);
                if(!montoFinal) return;

                fetch('/api/cuota/pagar', {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ plan_id: id, cantidad_cuotas: 1, moneda_pago: monedaPago.toUpperCase(), monto_pagado: montoFinal })
                }).then(r => r.json()).then(d => {
                    if(d.error) throw new Error(d.error);
                    mostrarMensaje(d.mensaje); cargarCuotasStatus(); cargarTransacciones(); cargarDashboardSummary();
                }).catch(e => alert(e.message));
            }
            else if(target.classList.contains('btn-editar-cuota')) {
                const data = JSON.parse(target.dataset.json);
                document.getElementById('cuota-descripcion').value = data.descripcion;
                document.getElementById('cuota-total').value = data.monto_total;
                document.getElementById('cuota-monto').value = data.monto_cuota;
                document.getElementById('cuota-total-cuotas').value = data.total_cuotas;
                document.getElementById('cuota-categoria').value = data.categoria_id;
                document.getElementById('cuota-fecha-inicio').value = data.fecha_inicio;
                if(document.getElementById('cuota-moneda')) document.getElementById('cuota-moneda').value = data.moneda || 'ARS';
                if(selectCuotaRecurrente) selectCuotaRecurrente.value = data.recurrente_id || "";

                formCuotaTitulo.textContent = 'Editar Plan';
                btnSubmitCuota.textContent = 'Actualizar';
                if(btnCancelarEdicionCuota) btnCancelarEdicionCuota.style.display = 'block';
                formCuota.dataset.editId = data.id;
                formCuota.scrollIntoView({behavior:'smooth'});
            }
            else if(target.classList.contains('btn-eliminar-cuota')) {
                if(confirm('¿Eliminar?')) {
                    fetch(`/api/cuota/${target.dataset.id}`, { method: 'DELETE' }).then(r=>r.json()).then(d=>{
                        if(d.error) throw new Error(d.error);
                        cargarCuotasStatus(); cargarDashboardSummary();
                    });
                }
            }
        });
    }

    // --- 7. MODALES (TARJETA Y HISTORIAL) ---
    const modalTarjeta = document.getElementById('modal-tarjeta');
    const formPagoTarjeta = document.getElementById('form-pago-tarjeta');
    const divListaCuotas = document.getElementById('lista-cuotas-tarjeta');
    const inputOtros = document.getElementById('tarjeta-otros-consumos');
    const spanTotalTarjeta = document.getElementById('tarjeta-total-pagar');
    const loadingTarjeta = document.getElementById('modal-tarjeta-loading');
    const btnCerrarModalTarjeta = document.getElementById('btn-cerrar-modal-tarjeta');

    function abrirModalTarjeta(idRecurrente, nombreTarjeta) {
        modalTarjeta.style.display = 'flex';
        setTimeout(() => modalTarjeta.style.opacity = '1', 10);
        document.getElementById('tarjeta-recurrente-id').value = idRecurrente;
        formPagoTarjeta.style.display = 'none'; loadingTarjeta.style.display = 'block';
        divListaCuotas.innerHTML = ''; inputOtros.value = 0; spanTotalTarjeta.textContent = "$0.00";

        fetch('/api/cuotas/status').then(r => r.json()).then(data => {
            loadingTarjeta.style.display = 'none'; formPagoTarjeta.style.display = 'block';
            // FILTRAR POR ID TARJETA
            const pendientes = data.filter(p => p.status_mes.includes('Pendiente') && p.recurrente_id == idRecurrente);
            
            if (pendientes.length === 0) divListaCuotas.innerHTML = '<p style="padding:10px; color:#777;">No hay cuotas pendientes.</p>';
            else {
                pendientes.forEach(p => {
                    const div = document.createElement('div');
                    div.style.padding = "5px"; div.style.borderBottom = "1px solid #eee";
                    div.innerHTML = `<label style="display:flex; align-items:center; cursor:pointer;">
                        <input type="checkbox" class="check-cuota" value="${p.id}" data-monto="${p.monto_cuota}" checked style="width:auto; margin-right:10px;">
                        <div><strong>${p.descripcion}</strong> <br> <small>${p.cuota_actual}/${p.total_cuotas} - ${formatearMoneda(p.monto_cuota, p.moneda)}</small></div>
                    </label>`;
                    divListaCuotas.appendChild(div);
                });
            }
            calcularTotalTarjeta();
        });
    }

    function calcularTotalTarjeta() {
        let total = 0;
        document.querySelectorAll('.check-cuota:checked').forEach(chk => total += parseFloat(chk.dataset.monto));
        total += parseFloat(inputOtros.value) || 0;
        spanTotalTarjeta.textContent = formatearMoneda(total); // Asume misma moneda para suma simple
        return total;
    }

    if (modalTarjeta) {
        divListaCuotas.addEventListener('change', calcularTotalTarjeta);
        inputOtros.addEventListener('input', calcularTotalTarjeta);
        if(btnCerrarModalTarjeta) btnCerrarModalTarjeta.addEventListener('click', () => { modalTarjeta.style.opacity='0'; setTimeout(()=>modalTarjeta.style.display='none',200); });

        formPagoTarjeta.addEventListener('submit', (e) => {
            e.preventDefault();
            const recurrenteId = document.getElementById('tarjeta-recurrente-id').value;
            const planesIds = Array.from(document.querySelectorAll('.check-cuota:checked')).map(c => c.value);
            const total = calcularTotalTarjeta();
            
            if(total <= 0) return alert("Monto debe ser mayor a 0");
            if(!confirm(`¿Pagar resumen por ${formatearMoneda(total)}?`)) return;

            fetch('/api/tarjeta/pagar-resumen', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ recurrente_id: recurrenteId, planes_ids: planesIds, monto_otros: document.getElementById('tarjeta-otros-consumos').value, monto_total: total })
            }).then(r => r.json()).then(d => {
                if(d.error) throw new Error(d.error); mostrarMensaje(d.mensaje);
                modalTarjeta.style.display = 'none'; cargarRecurrentesStatus(); cargarTransacciones(); cargarDashboardSummary(); cargarCuotasStatus();
            }).catch(e => alert(e.message));
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

    // --- 8. DASHBOARD ---
    function cargarDashboardSummary() {
        fetch('/api/dashboard/summary').then(r => r.json()).then(d => {
            function update(card, sel, val, mon) {
                if(card) {
                    const el = card.querySelector(sel);
                    if(el) {
                        el.textContent = formatearMoneda(val, mon);
                        if(sel.includes('saldo')) el.style.color = val < 0 ? 'red' : (mon==='USD'?'green':'blue');
                    }
                }
            }
            update(cardIngresos, '.val-ars', d.ARS.ingresos, 'ARS');
            update(cardGastos, '.val-ars', d.ARS.gastos, 'ARS');
            update(cardPendiente, '.val-ars', d.ARS.pendiente, 'ARS');
            update(cardSaldo, '.val-ars', d.ARS.saldo, 'ARS');

            update(cardIngresos, '.val-usd', d.USD.ingresos, 'USD');
            update(cardGastos, '.val-usd', d.USD.gastos, 'USD');
            update(cardPendiente, '.val-usd', d.USD.pendiente, 'USD');
            update(cardSaldo, '.val-usd', d.USD.saldo, 'USD');
        });
    }

    // --- 9. INICIO ---
    cargarCategorias();
    cargarTransacciones();
    cargarRecurrentesStatus();
    cargarDashboardSummary();
    cargarCuotasStatus();
});