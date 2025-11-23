// 1. ESPERAR A QUE EL HTML ESTÉ LISTO
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Cargado. Ejecutando app.js v9.1 (Fusionado y Optimizado)...");

    // --- 1. SELECTORES ---
    const apiStatusDiv = document.getElementById('api-status');
    
    // Dashboard
    const totalIngresosEl = document.getElementById('total-ingresos');
    const totalGastosEl = document.getElementById('total-gastos');
    const totalPendienteEl = document.getElementById('total-pendiente');
    const saldoActualEl = document.getElementById('saldo-actual');

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

    // Tablas
    const tablaBody = document.getElementById('lista-transacciones-body');
    const tablaRecurrentesBody = document.getElementById('lista-recurrentes-body');
    const tablaCuotasBody = document.getElementById('lista-cuotas-body');
    const selectRecurrenteCategoria = document.getElementById('recurrente-categoria');

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
            const overlay = document.createElement('div'); overlay.className = 'confirm-overlay';
            const dialog = document.createElement('div'); dialog.className = 'confirm-dialog';
            const message = document.createElement('p'); message.textContent = texto;
            const actions = document.createElement('div'); actions.className = 'confirm-actions';
            const btnStop = document.createElement('button'); btnStop.textContent = 'Detener'; btnStop.className = 'btn btn-secondary';
            const btnContinue = document.createElement('button'); btnContinue.textContent = 'Continuar'; btnContinue.className = 'btn btn-primary';

            const closeDialog = (result) => {
                overlay.style.opacity = '0'; dialog.style.transform = 'scale(0.9)';
                setTimeout(() => { document.body.removeChild(overlay); resolve(result); }, 200);
            };
            btnContinue.onclick = () => closeDialog(true);
            btnStop.onclick = () => closeDialog(false);

            actions.append(btnStop, btnContinue);
            dialog.append(message, actions);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            setTimeout(() => { overlay.style.opacity = '1'; dialog.style.transform = 'scale(1)'; }, 10);
        });
    }

    function formatearMoneda(numero) {
        const num = parseFloat(numero);
        if (isNaN(num)) return "$0.00";
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(num);
    }

    // --- 3. CARGA INICIAL DE DATOS ---

    fetch('/api/test').then(r => r.json()).then(data => {
        if (apiStatusDiv) apiStatusDiv.innerHTML = `<p style="color: green;">${data.mensaje}</p>`;
    }).catch(err => console.error(err));

    function cargarCategorias() {
        fetch('/api/categorias').then(r => r.json()).then(data => {
            [selectCategoria, selectRecurrenteCategoria, selectCuotaCategoria].forEach(sel => sel.innerHTML = '');
            
            const def1 = new Option("-- Sin Categoría --", "");
            selectCategoria.appendChild(def1);
            
            const def2 = new Option("-- Seleccionar --", "");
            selectRecurrenteCategoria.appendChild(def2.cloneNode(true));
            selectCuotaCategoria.appendChild(def2.cloneNode(true));

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
            formMensaje.textContent = 'Enviando...';
            const datos = Object.fromEntries(new FormData(formTransaccion).entries());

            fetch('/api/transaccion', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) })
            .then(r => r.json()).then(d => {
                if (d.error) throw new Error(d.error);
                mostrarMensaje(`¡${d.mensaje}!`);
                formTransaccion.reset();
                cargarTransacciones(); cargarDashboardSummary();
            })
            .catch(err => {
                formMensaje.textContent = `Error: ${err.message}`; formMensaje.style.color = 'red';
            });
        });
    }

    function cargarTransacciones() {
        if (!tablaBody) return;
        tablaBody.innerHTML = '<tr><td colspan="5">Cargando...</td></tr>';
        fetch('/api/transacciones').then(r => r.json()).then(data => {
            tablaBody.innerHTML = '';
            if (data.length === 0) return tablaBody.innerHTML = '<tr><td colspan="5">No hay movimientos.</td></tr>';

            data.forEach(t => {
                const tr = document.createElement('tr');
                const color = t.tipo === 'gasto' ? 'red' : 'green';
                const signo = t.tipo === 'gasto' ? '-' : '+';
                const fecha = t.fecha.split('-'); // YYYY-MM-DD
                
                tr.innerHTML = `
                    <td>${fecha[2]}/${fecha[1]}/${fecha[0]}</td>
                    <td>${t.descripcion}</td>
                    <td>${t.categoria_nombre || 'N/A'}</td>
                    <td>${t.tipo}</td>
                    <td style="color:${color}">${signo}${formatearMoneda(t.monto)}</td>
                `;
                tablaBody.appendChild(tr);
            });
        });
    }

    // --- 5. GASTOS RECURRENTES (Con Soporte Ingreso/Gasto) ---

    function resetFormRecurrente() {
        formRecurrente.reset();
        formRecurrenteTitulo.textContent = 'Definir Gasto Recurrente';
        btnSubmitRecurrente.textContent = 'Guardar Recurrente';
        btnCancelarEdicion.style.display = 'none';
        formRecurrente.dataset.editId = '';
        formRecurrenteMensaje.textContent = '';
    }

    if (btnCancelarEdicion) btnCancelarEdicion.addEventListener('click', resetFormRecurrente);

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
            }).catch(err => {
                formRecurrenteMensaje.textContent = `Error: ${err.message}`; formRecurrenteMensaje.style.color = 'red';
            });
        });
    }

    function cargarRecurrentesStatus() {
        if (!tablaRecurrentesBody) return;
        tablaRecurrentesBody.innerHTML = '<tr><td colspan="6">Cargando...</td></tr>';

        fetch('/api/recurrentes/status').then(r => r.json()).then(data => {
            tablaRecurrentesBody.innerHTML = '';
            if (data.length === 0) return tablaRecurrentesBody.innerHTML = '<tr><td colspan="6">No hay datos.</td></tr>';

            data.forEach(r => {
                const tr = document.createElement('tr');
                const procesado = r.status === 'Procesado' || r.status === 'Pagado'; // Compatibilidad
                const estilo = procesado ? 'color: green;' : 'color: orange;';
                
                let btn = '';
                if (!procesado) {
                    // LÓGICA DINÁMICA: COBRAR (Verde) vs PAGAR (Original)
                    const txt = r.tipo === 'ingreso' ? 'Cobrar' : 'Pagar';
                    const cls = r.tipo === 'ingreso' ? 'btn-cobrar' : 'btn-pagar';
                    btn = `<button class="${cls}" data-id="${r.id}" data-monto="${r.monto_estimado}" data-desc="${r.descripcion}" data-tipo="${r.tipo}">${txt}</button>`;
                } else {
                    btn = '<span class="text-success">Listo</span>';
                }

                const obsIcon = (r.observacion && r.observacion.trim()) ? ` <span class="obs-tooltip" title="${r.observacion}">ℹ️</span>` : '';

                // Guardamos JSON en data-atributo para editar fácil
                const jsonData = JSON.stringify(r).replace(/"/g, '&quot;');

                tr.innerHTML = `
                    <td>${r.descripcion}${obsIcon}</td>
                    <td>${r.categoria_nombre}</td>
                    <td>Día ${r.dia_vencimiento}</td>
                    <td>${formatearMoneda(r.monto_estimado)}</td>
                    <td style="${estilo}">${r.status}</td>
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

    if (tablaRecurrentesBody) {
        tablaRecurrentesBody.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            // 1. Pagar / Cobrar
            if (target.classList.contains('btn-pagar') || target.classList.contains('btn-cobrar')) {
                const { id, monto, desc, tipo } = target.dataset;
                const accion = tipo === 'ingreso' ? 'cobro' : 'pago';
                const real = prompt(`Confirmar ${accion} de "${desc}". Monto real:`, monto);
                
                if (real && !isNaN(real) && real > 0) {
                    target.disabled = true; target.textContent = '...';
                    fetch('/api/recurrente/pagar', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ recurrente_id: id, monto_pagado: real }) })
                    .then(r => r.json()).then(d => {
                        if(d.error) throw new Error(d.error);
                        mostrarMensaje(`¡Éxito! ${d.mensaje}`);
                        cargarRecurrentesStatus(); cargarTransacciones(); cargarDashboardSummary();
                    }).catch(err => { mostrarMensaje(`Error: ${err.message}`); target.disabled = false; });
                }
            }
            // 2. Eliminar
            else if (target.classList.contains('btn-eliminar-recurrente')) {
                mostrarConfirmacion(`¿Eliminar "${target.dataset.desc}"?`).then(ok => {
                    if (ok) {
                        fetch(`/api/recurrente/${target.dataset.id}`, { method: 'DELETE' })
                        .then(r => r.json()).then(d => {
                            if(d.error) throw new Error(d.error);
                            mostrarMensaje(d.mensaje); cargarRecurrentesStatus(); cargarDashboardSummary();
                        });
                    }
                });
            }
            // 3. Editar
            else if (target.classList.contains('btn-editar-recurrente')) {
                const data = JSON.parse(target.dataset.json);
                document.getElementById('recurrente-descripcion').value = data.descripcion;
                document.getElementById('recurrente-monto').value = data.monto_estimado;
                document.getElementById('recurrente-dia').value = data.dia_vencimiento;
                document.getElementById('recurrente-categoria').value = data.categoria_id;
                document.getElementById('recurrente-observacion').value = data.observacion || '';
                if (selectRecurrenteTipo) selectRecurrenteTipo.value = data.tipo || 'gasto';

                formRecurrenteTitulo.textContent = 'Editar Gasto Recurrente';
                btnSubmitRecurrente.textContent = 'Actualizar';
                btnCancelarEdicion.style.display = 'block';
                formRecurrente.dataset.editId = data.id;
                formRecurrente.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    // --- 6. PLANES DE CUOTAS ---

    function resetFormCuota() {
        formCuota.reset();
        formCuotaTitulo.textContent = 'Definir Plan de Cuotas';
        btnSubmitCuota.textContent = 'Guardar Plan';
        btnCancelarEdicionCuota.style.display = 'none';
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
                mostrarMensaje(d.mensaje);
                resetFormCuota();
                cargarCuotasStatus(); cargarDashboardSummary();
            }).catch(err => {
                formCuotaMensaje.textContent = `Error: ${err.message}`; formCuotaMensaje.style.color = 'red';
            });
        });
    }

    function cargarCuotasStatus() {
        if (!tablaCuotasBody) return;
        fetch('/api/cuotas/status').then(r => r.json()).then(data => {
            tablaCuotasBody.innerHTML = '';
            if (data.length === 0) return tablaCuotasBody.innerHTML = '<tr><td colspan="6">No hay datos.</td></tr>';

            data.forEach(p => {
                const tr = document.createElement('tr');
                const estilo = p.status_mes.includes('Pagado') ? 'color: green;' : 'color: orange;';
                const jsonData = JSON.stringify(p).replace(/"/g, '&quot;');
                const restantes = p.total_cuotas - p.cuota_actual;

                let btn = '';
                if (p.status_mes.includes('Pendiente')) {
                    btn = `<button class="btn-pagar-cuota" data-id="${p.id}" data-monto="${p.monto_cuota}" data-restantes="${restantes}" data-desc="${p.descripcion}">Pagar</button>`;
                } else {
                    btn = '<span class="text-success">Listo</span>';
                }

                tr.innerHTML = `
                    <td>${p.descripcion}</td>
                    <td>${p.categoria_nombre}</td>
                    <td>${p.cuota_actual}/${p.total_cuotas}</td>
                    <td>${formatearMoneda(p.monto_cuota)}</td>
                    <td style="${estilo}">${p.status_mes}</td>
                    <td>
                        ${btn}
                        <button class="btn-accion btn-editar-cuota" data-json="${jsonData}">✏️</button>
                        <button class="btn-accion btn-eliminar-cuota" data-id="${p.id}" data-desc="${p.descripcion}">❌</button>
                    </td>
                `;
                tablaCuotasBody.appendChild(tr);
            });
        });
    }

    if (tablaCuotasBody) {
        tablaCuotasBody.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            if (target.classList.contains('btn-pagar-cuota')) {
                const cant = prompt(`Pagar "${target.dataset.desc}".\nQuedan ${target.dataset.restantes}. ¿Cuántas pagas?`, "1");
                if (cant && !isNaN(cant) && cant > 0) {
                    target.disabled = true;
                    fetch('/api/cuota/pagar', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ plan_id: target.dataset.id, cantidad_cuotas: parseInt(cant) }) })
                    .then(r => r.json()).then(d => {
                        if(d.error) throw new Error(d.error);
                        mostrarMensaje(d.mensaje);
                        cargarCuotasStatus(); cargarTransacciones(); cargarDashboardSummary();
                    }).catch(err => { mostrarMensaje(`Error: ${err.message}`); target.disabled = false; });
                }
            }
            else if (target.classList.contains('btn-eliminar-cuota')) {
                mostrarConfirmacion(`¿Eliminar plan "${target.dataset.desc}"?`).then(ok => {
                    if (ok) {
                        fetch(`/api/cuota/${target.dataset.id}`, { method: 'DELETE' })
                        .then(r => r.json()).then(d => {
                            if(d.error) throw new Error(d.error);
                            mostrarMensaje(d.mensaje); cargarCuotasStatus(); cargarDashboardSummary();
                        });
                    }
                });
            }
            else if (target.classList.contains('btn-editar-cuota')) {
                const data = JSON.parse(target.dataset.json);
                document.getElementById('cuota-descripcion').value = data.descripcion;
                document.getElementById('cuota-total').value = data.monto_total;
                document.getElementById('cuota-monto').value = data.monto_cuota;
                document.getElementById('cuota-total-cuotas').value = data.total_cuotas;
                document.getElementById('cuota-categoria').value = data.categoria_id;
                document.getElementById('cuota-fecha-inicio').value = data.fecha_inicio;

                formCuotaTitulo.textContent = 'Editar Plan';
                btnSubmitCuota.textContent = 'Actualizar';
                if(btnCancelarEdicionCuota) btnCancelarEdicionCuota.style.display = 'block';
                formCuota.dataset.editId = data.id;
                formCuota.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    // --- 7. RESUMEN ---
    function cargarDashboardSummary() {
        fetch('/api/dashboard/summary').then(r => r.json()).then(data => {
            if (totalIngresosEl) totalIngresosEl.textContent = formatearMoneda(data.total_ingresos);
            if (totalGastosEl) totalGastosEl.textContent = formatearMoneda(data.total_gastos);
            if (totalPendienteEl) totalPendienteEl.textContent = formatearMoneda(data.total_pendiente);
            if (saldoActualEl) {
                saldoActualEl.textContent = formatearMoneda(data.saldo_actual);
                saldoActualEl.style.color = data.saldo_actual < 0 ? 'red' : 'blue';
            }
        });
    }

    // --- 8. INICIO ---
    cargarCategorias();
    cargarTransacciones();
    cargarRecurrentesStatus();
    cargarDashboardSummary();
    cargarCuotasStatus();
});