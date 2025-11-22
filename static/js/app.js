// 1. ESPERAR A QUE EL HTML ESTÉ LISTO
document.addEventListener('DOMContentLoaded', () => {
    
    console.log("DOM Cargado. Ejecutando app.js v8.2 (CRUD Completo)...");

    // --- === 2. Selectores de elementos === ---
    // (Solo se ejecutan DESPUÉS de que el HTML cargó)
    
    // API Status
    const apiStatusDiv = document.getElementById('api-status');

    // Resumen Dashboard
    const totalIngresosEl = document.getElementById('total-ingresos');
    const totalGastosEl = document.getElementById('total-gastos');
    const totalPendienteEl = document.getElementById('total-pendiente');
    const saldoActualEl = document.getElementById('saldo-actual');

    // Formulario de Transacciones
    const formTransaccion = document.getElementById('form-transaccion');
    const formMensaje = document.getElementById('form-mensaje');
    const selectCategoria = document.getElementById('categoria'); 
    
    // Formulario de Recurrentes
    const formRecurrente = document.getElementById('form-recurrente');
    const formRecurrenteTitulo = document.getElementById('form-recurrente-titulo');
    const formRecurrenteMensaje = document.getElementById('form-recurrente-mensaje');
    const btnSubmitRecurrente = document.getElementById('btn-submit-recurrente');
    const btnCancelarEdicion = document.getElementById('btn-cancelar-edicion');
    
    // Formulario de Cuotas
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

    // --- === 3. Funciones Auxiliares === ---

    function mostrarMensaje(texto) {
        const toast = document.createElement('div');
        toast.textContent = texto;
        toast.style.cssText = `
            position: fixed;
            top: -100px;
            left: 50%;
            transform: translateX(-50%);
            background: #7e9d0dff;
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            z-index: 9999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: top 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => toast.style.top = '20px', 10);
        
        setTimeout(() => {
            toast.style.top = '-100px';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }


    async function mostrarConfirmacion(texto) {
        return new Promise((resolve) => {
            // Crear el fondo oscuro
            const overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';

            // Crear la caja del diálogo
            const dialog = document.createElement('div');
            dialog.className = 'confirm-dialog';

            // Crear el mensaje
            const message = document.createElement('p');
            message.textContent = texto;

            // Crear el contenedor de botones
            const actions = document.createElement('div');
            actions.className = 'confirm-actions';

            // Crear el botón de "Detener"
            const btnStop = document.createElement('button');
            btnStop.textContent = 'Detener';
            btnStop.className = 'btn btn-secondary';
            
            // Crear el botón de "Continuar"
            const btnContinue = document.createElement('button');
            btnContinue.textContent = 'Continuar';
            btnContinue.className = 'btn btn-primary';

            // Función para cerrar y eliminar el diálogo
            const closeDialog = (result) => {
                overlay.style.opacity = '0';
                dialog.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    document.body.removeChild(overlay);
                    resolve(result); // Devuelve 'true' o 'false'
                }, 200);
            };

            // Asignar eventos a los botones
            btnContinue.onclick = () => closeDialog(true);
            btnStop.onclick = () => closeDialog(false);

            // Armar la estructura
            actions.appendChild(btnStop);
            actions.appendChild(btnContinue);
            dialog.appendChild(message);
            dialog.appendChild(actions);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // Animación de entrada
            setTimeout(() => {
                overlay.style.opacity = '1';
                dialog.style.transform = 'scale(1)';
            }, 10);
        });
    }

    function formatearMoneda(numero) {
        const num = parseFloat(numero);
        if (isNaN(num)) {
            return "$0.00"; 
        }
        return new Intl.NumberFormat('es-AR', { 
            style: 'currency', 
            currency: 'ARS' 
        }).format(num);
    }

    // --- === 4. API Test === ---
    fetch('/api/test')
        .then(response => response.json())
        .then(data => {
            apiStatusDiv.innerHTML = `<p style="color: green;">${data.mensaje}</p>`;
        })
        .catch(error => {
            console.error('Error al llamar a la API de test:', error);
            apiStatusDiv.innerHTML = `<p style="color: red;">Error al conectar con la API.</p>`;
        });

    // --- === 5. Cargar Categorías === ---
    function cargarCategorias() {
        console.log("Cargando categorías...");
        fetch('/api/categorias')
            .then(response => {
                if (!response.ok) { throw new Error('Error al cargar categorías'); }
                return response.json();
            })
            .then(data => {
                console.log("Categorías recibidas:", data);
                
                selectCategoria.innerHTML = ''; 
                selectRecurrenteCategoria.innerHTML = '';
                selectCuotaCategoria.innerHTML = '';

                const opcionDefault = document.createElement('option');
                opcionDefault.value = ""; 
                opcionDefault.textContent = "-- Sin Categoría --";
                selectCategoria.appendChild(opcionDefault);

                const opcionRecurrenteDefault = document.createElement('option');
                opcionRecurrenteDefault.value = ""; 
                opcionRecurrenteDefault.textContent = "-- Seleccione Categoría --";
                selectRecurrenteCategoria.appendChild(opcionRecurrenteDefault.cloneNode(true));
                selectCuotaCategoria.appendChild(opcionRecurrenteDefault.cloneNode(true));

                data.forEach(categoria => {
                    const opcion = document.createElement('option');
                    opcion.value = categoria.id;
                    opcion.textContent = categoria.nombre;
                    
                    selectCategoria.appendChild(opcion.cloneNode(true));
                    selectRecurrenteCategoria.appendChild(opcion.cloneNode(true));
                    selectCuotaCategoria.appendChild(opcion.cloneNode(true));
                });
            })
            .catch(error => {
                console.error(error);
                selectCategoria.innerHTML = `<option value="">Error</option>`;
                selectRecurrenteCategoria.innerHTML = `<option value="">Error</option>`;
                selectCuotaCategoria.innerHTML = `<option value="">Error</option>`;
            });
    }

    // --- === 6. Lógica: Transacciones (Formulario y Lista) === ---
    if (formTransaccion) {
        formTransaccion.addEventListener('submit', (event) => {
            event.preventDefault(); 
            formMensaje.textContent = 'Enviando...';
            
            const formData = new FormData(formTransaccion);
            const datos = {
                descripcion: formData.get('descripcion'),
                monto: formData.get('monto'),
                tipo: formData.get('tipo'),
                categoria_id: formData.get('categoria_id') 
            };

            fetch('/api/transaccion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datos) 
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) { throw new Error(data.error); }

                console.log("Respuesta del servidor:", data);
                formMensaje.textContent = `¡${data.mensaje}! (ID: ${data.id})`;
                formMensaje.style.color = 'green';
                formTransaccion.reset(); 
                
                cargarTransacciones(); 
                cargarDashboardSummary();
            })
            .catch(error => {
                console.error('Error al agregar transacción:', error);
                formMensaje.textContent = `Error: ${error.message}`;
                formMensaje.style.color = 'red';
            });
        });
    }

    function cargarTransacciones() {
        console.log("Cargando transacciones...");
        
        // Comprobación de seguridad
        if (!tablaBody) {
            console.error("Error: No se encontró 'lista-transacciones-body'");
            return;
        }

        tablaBody.innerHTML = '<tr><td colspan="5">Cargando...</td></tr>';

        fetch('/api/transacciones')
            .then(response => {
                if (!response.ok) { throw new Error('Error al obtener transacciones'); }
                return response.json();
            })
            .then(data => {
                console.log("Transacciones recibidas:", data);
                tablaBody.innerHTML = ''; 

                if (data.length === 0) {
                    tablaBody.innerHTML = '<tr><td colspan="5">No hay movimientos registrados.</td></tr>';
                    return;
                }

                data.forEach(transaccion => { // <-- 'transaccion' se define AQUÍ
                    const fila = document.createElement('tr');
                    const estiloMonto = transaccion.tipo === 'gasto' ? 'color: red;' : 'color: green;';
                    const categoriaTexto = transaccion.categoria_nombre || 'N/A';

                    // --- INICIO DEL CÓDIGO DE FECHA (Lugar Correcto) ---
                    const partesFecha = transaccion.fecha.split('-'); // ["2025", "11", "07"]
                    const fechaFormateada = `${partesFecha[2]}/${partesFecha[1]}/${partesFecha[0]}`; // "07/11/2025"
                    // --- FIN DEL CÓDIGO DE FECHA ---

                    fila.innerHTML = `
                        <td>${fechaFormateada}</td> <td>${transaccion.descripcion}</td>
                        <td>${categoriaTexto}</td> 
                        <td>${transaccion.tipo}</td>
                        <td style="${estiloMonto}">${transaccion.tipo === 'gasto' ? '-' : '+'}${formatearMoneda(transaccion.monto)}</td>
                    `;
                    tablaBody.appendChild(fila);
                });
            })
            .catch(error => {
                console.error('Error al cargar transacciones:', error);
                tablaBody.innerHTML = `<tr><td colspan="5" style="color: red;">${error.message}</td></tr>`;
            });
    }

    // --- === 7. Lógica: Gastos Recurrentes (CRUD) === ---
    
    function resetFormRecurrente() {
        if (formRecurrente) {
            formRecurrente.reset(); 
        }
        if (formRecurrenteTitulo) {
            formRecurrenteTitulo.textContent = 'Definir Gasto Recurrente';
        }
        if (btnSubmitRecurrente) {
            btnSubmitRecurrente.textContent = 'Guardar Recurrente';
        }
        if (btnCancelarEdicion) {
            btnCancelarEdicion.style.display = 'none'; 
        }
        if (formRecurrente) {
            formRecurrente.dataset.editId = ''; 
        }
        if (formRecurrenteMensaje) {
            formRecurrenteMensaje.textContent = '';
        }
    }

    if (btnCancelarEdicion) {
        btnCancelarEdicion.addEventListener('click', () => {
            resetFormRecurrente();
        });
    }

    if (formRecurrente) {
        formRecurrente.addEventListener('submit', (event) => {
            event.preventDefault();
            formRecurrenteMensaje.textContent = 'Guardando...';
            
            const formData = new FormData(formRecurrente);
            const datos = {
                descripcion: formData.get('descripcion'),
                monto_estimado: formData.get('monto_estimado'),
                dia_vencimiento: formData.get('dia_vencimiento'),
                categoria_id: formData.get('categoria_id'),
                observacion: formData.get('observacion')
            };

            const editId = formRecurrente.dataset.editId;
            let url = '/api/recurrente';
            let method = 'POST';

            if (editId) {
                url = `/api/recurrente/${editId}`;
                method = 'PUT';
            }

            fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datos)
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) { throw new Error(data.error); }
                
                mostrarMensaje(data.mensaje);
                resetFormRecurrente(); 
                
                cargarRecurrentesStatus(); 
                cargarDashboardSummary(); 
            })
            .catch(error => {
                console.error('Error al guardar recurrente:', error);
                formRecurrenteMensaje.textContent = `Error: ${error.message}`;
                formRecurrenteMensaje.style.color = 'red';
            });
        });
    }

    function cargarRecurrentesStatus() {
        console.log("Cargando estado de gastos recurrentes...");
        
        if (!tablaRecurrentesBody) {
            console.error("Error: No se encontró 'lista-recurrentes-body'");
            return;
        }
        
        tablaRecurrentesBody.innerHTML = '<tr><td colspan="6">Cargando...</td></tr>';

        fetch('/api/recurrentes/status')
            .then(response => {
                if (!response.ok) { throw new Error('Error al cargar estado'); }
                return response.json();
            })
            .then(data => {
                console.log("Estado de recurrentes recibido:", data);
                tablaRecurrentesBody.innerHTML = ''; 

                if (data.length === 0) {
                    tablaRecurrentesBody.innerHTML = '<tr><td colspan="6">No hay gastos recurrentes definidos.</td></tr>';
                    return;
                }

                data.forEach(recurrente => {
                    const fila = document.createElement('tr');
                    const estadoEstilo = recurrente.status === 'Pagado' ? 'color: green;' : 'color: orange;';
                    
                    let acciones = '';
                    if (recurrente.status === 'Pendiente') {
                        acciones += `<button class="btn-pagar" data-id="${recurrente.id}" data-monto-estimado="${recurrente.monto_estimado}" data-descripcion="${recurrente.descripcion}">Pagar</button>`;
                    } else {
                        acciones += `<span class="text-success">Pagado</span>`;
                    }
                    
                    acciones += `
                        <button class="btn-accion btn-editar-recurrente" 
                            data-id="${recurrente.id}"
                            data-descripcion="${recurrente.descripcion}"
                            data-monto="${recurrente.monto_estimado}"
                            data-dia="${recurrente.dia_vencimiento}"
                            data-categoria-id="${recurrente.categoria_id}"
                            data-observacion="${recurrente.observacion || ''}"
                            title="Editar">
                            ✏️
                        </button>`;

                    acciones += `
                        <button class="btn-accion btn-eliminar-recurrente" 
                            data-id="${recurrente.id}"
                            data-descripcion="${recurrente.descripcion}"
                            title="Eliminar">
                            ❌
                        </button>`;
                                        
                    let observacionHtml = '';
                    // (Verificamos que la observación no sea null O una cadena vacía)
                    if (recurrente.observacion && recurrente.observacion.trim() !== '') {
                        // El 'title' es lo que crea el tooltip nativo al pasar el mouse
                        observacionHtml = ` <span class="obs-tooltip" title="${recurrente.observacion}">ℹ️</span>`;
                    }                

                    fila.innerHTML = `
                        <td>${recurrente.descripcion}${observacionHtml}</td> 
                        <td>${recurrente.categoria_nombre}</td>
                        <td>Día ${recurrente.dia_vencimiento}</td>
                        <td>${formatearMoneda(recurrente.monto_estimado)}</td>
                        <td style="${estadoEstilo}">${recurrente.status}</td>
                        <td>${acciones}</td>
                    `;
                    tablaRecurrentesBody.appendChild(fila);
                });
            })
            .catch(error => {
                console.error(error);
                tablaRecurrentesBody.innerHTML = `<tr><td colspan="6" style="color: red;">${error.message}</td></tr>`;
            });
    }

    if (tablaRecurrentesBody) {
        tablaRecurrentesBody.addEventListener('click', (event) => {
            const target = event.target.closest('button');
            if (!target) return;

            // 1. Pagar
            if (target.classList.contains('btn-pagar')) {
                const boton = target;
                const id = boton.dataset.id;
                const montoEstimado = boton.dataset.montoEstimado;
                const descripcion = boton.dataset.descripcion;

                const montoPagado = prompt(
                    `¿Confirmar pago de "${descripcion}"?\nIntroduce el monto pagado (estimado ${formatearMoneda(montoEstimado)}):`, 
                    montoEstimado
                );

                if (montoPagado === null) {
                    return; 
                }
                if (isNaN(montoPagado) || montoPagado <= 0) {
                    mostrarMensaje("Monto inválido. El pago no se registró.");
                    return;
                }

                boton.textContent = 'Pagando...';
                boton.disabled = true;

                fetch('/api/recurrente/pagar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        recurrente_id: id,
                        monto_pagado: montoPagado
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.error) { throw new Error(data.error); }
                    
                    mostrarMensaje(`¡Éxito! ${data.mensaje}`);
                    cargarRecurrentesStatus();
                    cargarTransacciones();     
                    cargarDashboardSummary(); 
                })
                .catch(error => {
                    console.error("Error al pagar:", error);
                    mostrarMensaje(`Error: ${error.message}`);
                    boton.textContent = 'Pagar';
                    boton.disabled = false;
                });
            } 
            
            // 2. Eliminar
            else if (target.classList.contains('btn-eliminar-recurrente')) {
                const id = target.dataset.id;
                const descripcion = target.dataset.descripcion;
                
                if (mostrarConfirmacion(`¿Estás seguro de que quieres eliminar el gasto recurrente "${descripcion}"?`)) {
                    fetch(`/api/recurrente/${id}`, {
                        method: 'DELETE'
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.error) throw new Error(data.error);
                        
                        mostrarMensaje(data.mensaje);
                        cargarRecurrentesStatus();
                        cargarDashboardSummary();
                    })
                    .catch(error => {
                        console.error("Error al eliminar:", error);
                        mostrarMensaje(`Error: ${error.message}`);
                    });
                }
            }
            
            // 3. Editar
            else if (target.classList.contains('btn-editar-recurrente')) {
                const id = target.dataset.id;
                
                // Rellenar el formulario
                document.getElementById('recurrente-descripcion').value = target.dataset.descripcion;
                document.getElementById('recurrente-monto').value = target.dataset.monto;
                document.getElementById('recurrente-dia').value = target.dataset.dia;
                document.getElementById('recurrente-categoria').value = target.dataset.categoriaId;
                document.getElementById('recurrente-observacion').value = target.dataset.observacion; // <-- NUEVA LÍNEA
                
                // Poner en "Modo Edición"
                formRecurrenteTitulo.textContent = 'Editar Gasto Recurrente';
                btnSubmitRecurrente.textContent = 'Actualizar Cambios';
                btnCancelarEdicion.style.display = 'block'; 
                formRecurrente.dataset.editId = id;
                
                formRecurrente.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    // --- === 8. Lógica: Planes de Cuotas (CRUD) === ---

    function resetFormCuota() {
        if (formCuota) {
            formCuota.reset();
        }
        if (formCuotaTitulo) {
            formCuotaTitulo.textContent = 'Definir Plan de Cuotas';
        }
        if (btnSubmitCuota) {
            btnSubmitCuota.textContent = 'Guardar Plan';
        }
        if (btnCancelarEdicionCuota) {
            btnCancelarEdicionCuota.style.display = 'none';
        }
        if (formCuota) {
            formCuota.dataset.editId = '';
        }
        if (formCuotaMensaje) {
            formCuotaMensaje.textContent = '';
        }
    }
    
    // ESTA ES LA LÍNEA 317 (ahora 319) - LA CAUSA DEL ERROR
    // La envolvemos en un chequeo 'if' por si el botón no existe
    if (btnCancelarEdicionCuota) {
        btnCancelarEdicionCuota.addEventListener('click', () => {
            resetFormCuota();
        });
    } else {
        console.warn("Advertencia: El botón 'btn-cancelar-edicion-cuota' no se encontró. Esto es normal si no estás en esa página.");
    }

    if (formCuota) {
        formCuota.addEventListener('submit', (event) => {
            event.preventDefault();
            formCuotaMensaje.textContent = 'Guardando...';
            
            const formData = new FormData(formCuota);
            const datos = {
                descripcion: formData.get('descripcion'),
                monto_total: formData.get('monto_total'),
                monto_cuota: formData.get('monto_cuota'),
                total_cuotas: formData.get('total_cuotas'),
                categoria_id: formData.get('categoria_id'),
                fecha_inicio: formData.get('fecha_inicio')
            };

            const editId = formCuota.dataset.editId;
            let url = '/api/cuota';
            let method = 'POST';

            if (editId) {
                url = `/api/cuota/${editId}`;
                method = 'PUT';
            }

            fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datos)
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) { throw new Error(data.error); }
                
                mostrarMensaje(data.mensaje);
                resetFormCuota();
                cargarCuotasStatus();
                cargarDashboardSummary(); 
            })
            .catch(error => {
                console.error('Error al guardar plan de cuota:', error);
                formCuotaMensaje.textContent = `Error: ${error.message}`;
                formCuotaMensaje.style.color = 'red';
            });
        });
    }

    function cargarCuotasStatus() {
        console.log("Cargando estado de planes de cuotas...");
        if (!tablaCuotasBody) {
            console.error("Error: No se encontró 'lista-cuotas-body'");
            return;
        }

        tablaCuotasBody.innerHTML = '<tr><td colspan="6">Cargando...</td></tr>';

        fetch('/api/cuotas/status')
            .then(response => {
                if (!response.ok) { throw new Error('Error al cargar estado de cuotas'); }
                return response.json();
            })
            .then(data => {
                console.log("Estado de cuotas recibido:", data);
                tablaCuotasBody.innerHTML = ''; 

                if (data.length === 0) {
                    tablaCuotasBody.innerHTML = '<tr><td colspan="6">No hay planes de cuotas activos.</td></tr>';
                    return;
                }

                data.forEach(plan => {
                    const fila = document.createElement('tr');
                    const estadoEstilo = plan.status_mes === 'Pagado este mes' ? 'color: green;' : 'color: orange;';
                    
                    let acciones = '';
                    if (plan.status_mes === 'Pendiente este mes') {
                        // --- CAMBIO AQUÍ: Añadimos más data- al botón ---
                        acciones += `<button class="btn-pagar-cuota" 
                                        data-id="${plan.id}" 
                                        data-monto="${plan.monto_cuota}"
                                        data-cuota-actual="${plan.cuota_actual}"
                                        data-total-cuotas="${plan.total_cuotas}"
                                        data-descripcion="${plan.descripcion}"
                                        title="Pagar Cuota">
                                        Pagar Cuota
                                    </button>`;
                    } else {
                        acciones += `<span class="text-success">Pagado</span>`;
                    }
                    
                    acciones += `
                        <button class="btn-accion btn-editar-cuota" 
                            data-id="${plan.id}"
                            data-descripcion="${plan.descripcion}"
                            data-monto-total="${plan.monto_total}"
                            data-monto-cuota="${plan.monto_cuota}"
                            data-total-cuotas="${plan.total_cuotas}"
                            data-categoria-id="${plan.categoria_id}"
                            data-fecha-inicio="${plan.fecha_inicio}" 
                            title="Editar">
                            ✏️
                        </button>`;

                    acciones += `
                        <button class="btn-accion btn-eliminar-cuota" 
                            data-id="${plan.id}"
                            data-descripcion="${plan.descripcion}"
                            title="Eliminar">
                            ❌
                        </button>`;

                    fila.innerHTML = `
                        <td>${plan.descripcion}</td>
                        <td>${plan.categoria_nombre}</td>
                        <td>Cuota ${plan.cuota_actual} de ${plan.total_cuotas}</td>
                        <td>${formatearMoneda(plan.monto_cuota)}</td>
                        <td style="${estadoEstilo}">${plan.status_mes}</td>
                        <td>${acciones}</td>
                    `;
                    tablaCuotasBody.appendChild(fila);
                });
            })
            .catch(error => {
                console.error(error);
                tablaCuotasBody.innerHTML = `<tr><td colspan="6" style="color: red;">${error.message}</td></tr>`;
            });
    }

    if (tablaCuotasBody) {
        tablaCuotasBody.addEventListener('click', (event) => {
            const target = event.target.closest('button');
            if (!target) return;

            // 1. Pagar Cuota (MODIFICADO)
            if (target.classList.contains('btn-pagar-cuota')) {
                const boton = target;
                const id = boton.dataset.id;
                const monto = boton.dataset.monto;
                const descripcion = boton.dataset.descripcion;
                const cuotaActual = parseInt(boton.dataset.cuotaActual);
                const totalCuotas = parseInt(boton.dataset.totalCuotas);
                
                const cuotasRestantes = totalCuotas - cuotaActual;

                // --- CAMBIO CLAVE: Usamos prompt() ---
                const cantidadInput = prompt(
                    `Vas a pagar "${descripcion}" (${formatearMoneda(monto)} c/u).\n\n¿Cuántas cuotas querés pagar? (Quedan ${cuotasRestantes})`, 
                    "1" // Valor por defecto
                );

                if (cantidadInput === null) {
                    return; // Usuario canceló
                }
                
                const cantidadAPagar = parseInt(cantidadInput);

                // Validaciones en el frontend
                if (isNaN(cantidadAPagar) || cantidadAPagar <= 0) {
                    mostrarMensaje("Cantidad inválida. Debe ser un número mayor a 0.");
                    return;
                }
                if (cantidadAPagar > cuotasRestantes) {
                    mostrarMensaje(`Error: No puedes pagar ${cantidadAPagar} cuotas. Solo quedan ${cuotasRestantes}.`);
                    return;
                }
                // --- FIN CAMBIO CLAVE ---
                
                boton.textContent = 'Pagando...';
                boton.disabled = true;

                fetch('/api/cuota/pagar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        plan_id: id,
                        cantidad_cuotas: cantidadAPagar // <-- Enviamos la cantidad
                    }) 
                })
                .then(response => response.json())
                .then(data => {
                    if (data.error) { throw new Error(data.error); }
                    
                    mostrarMensaje(`¡Éxito! ${data.mensaje}`);
                    
                    // Refrescar todo
                    cargarCuotasStatus();
                    cargarTransacciones();
                    cargarDashboardSummary();
                })
                .catch(error => {
                    console.error("Error al pagar cuota:", error);
                    mostrarMensaje(`Error: ${error.message}`);
                    boton.textContent = 'Pagar Cuota';
                    boton.disabled = false;
                });
            }
            
            // 2. Eliminar Cuota
            else if (target.classList.contains('btn-eliminar-cuota')) {
                // ... (Tu lógica de eliminar sin cambios)
                const id = target.dataset.id;
                const descripcion = target.dataset.descripcion;
                
                if (mostrarConfirmacion(`¿Estás seguro de que quieres eliminar el plan de cuotas "${descripcion}"?`)) {
                    fetch(`/api/cuota/${id}`, { method: 'DELETE' })
                    .then(response => response.json())
                    .then(data => {
                        if (data.error) throw new Error(data.error);
                        mostrarMensaje(data.mensaje);
                        cargarCuotasStatus();
                        cargarDashboardSummary(); 
                    })
                    .catch(error => { mostrarMensaje(`Error: ${error.message}`); });
                }
            }
            
            // 3. Editar Cuota
            else if (target.classList.contains('btn-editar-cuota')) {
                // ... (Tu lógica de editar sin cambios)
                const id = target.dataset.id;
                document.getElementById('cuota-descripcion').value = target.dataset.descripcion;
                document.getElementById('cuota-total').value = target.dataset.montoTotal;
                document.getElementById('cuota-monto').value = target.dataset.montoCuota;
                document.getElementById('cuota-total-cuotas').value = target.dataset.totalCuotas;
                document.getElementById('cuota-categoria').value = target.dataset.categoriaId;
                document.getElementById('cuota-fecha-inicio').value = target.dataset.fechaInicio;
                
                formCuotaTitulo.textContent = 'Editar Plan de Cuotas';
                btnSubmitCuota.textContent = 'Actualizar Plan';
                btnCancelarEdicionCuota.style.display = 'block';
                formCuota.dataset.editId = id;
                
                formCuota.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    // --- === 9. Lógica: Resumen del Dashboard === ---
    
    function cargarDashboardSummary() {
        console.log("Cargando resumen del dashboard...");
        
        fetch('/api/dashboard/summary')
            .then(response => {
                if (!response.ok) { throw new Error('Error al cargar resumen'); }
                return response.json();
            })
            .then(data => {
                console.log("Resumen recibido:", data);
                
                if (totalIngresosEl) {
                    totalIngresosEl.textContent = formatearMoneda(data.total_ingresos);
                }
                if (totalGastosEl) {
                    totalGastosEl.textContent = formatearMoneda(data.total_gastos);
                }
                if (totalPendienteEl) {
                    totalPendienteEl.textContent = formatearMoneda(data.total_pendiente);
                }
                if (saldoActualEl) {
                    saldoActualEl.textContent = formatearMoneda(data.saldo_actual);
                    saldoActualEl.style.color = data.saldo_actual < 0 ? 'red' : 'blue';
                }
            })
            .catch(error => {
                console.error(error);
                if (totalIngresosEl) totalIngresosEl.textContent = "Error";
                if (totalGastosEl) totalGastosEl.textContent = "Error";
                if (totalPendienteEl) totalPendienteEl.textContent = "Error";
                if (saldoActualEl) saldoActualEl.textContent = "Error";
            });
    }

    // --- === 10. Llamadas Iniciales === ---
    cargarCategorias();
    cargarTransacciones();
    cargarRecurrentesStatus();
    cargarDashboardSummary();
    cargarCuotasStatus();

}); // --- FIN DE DOMCONTENTLOADED ---