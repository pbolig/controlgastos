document.addEventListener('DOMContentLoaded', () => {
    
    console.log("DOM Cargado. Ejecutando app.js v2 (con categorías)...");

    // --- Selectores de elementos ---
    const apiStatusDiv = document.getElementById('api-status');
    const formTransaccion = document.getElementById('form-transaccion');
    const formMensaje = document.getElementById('form-mensaje');
    const tablaBody = document.getElementById('lista-transacciones-body');
    const selectCategoria = document.getElementById('categoria');

    // --- Selectores para Recurrentes ---
    const formRecurrente = document.getElementById('form-recurrente');
    const formRecurrenteMensaje = document.getElementById('form-recurrente-mensaje');
    const selectRecurrenteCategoria = document.getElementById('recurrente-categoria');
    const formRecurrenteTitulo = document.getElementById('form-recurrente-titulo');
    const btnSubmitRecurrente = document.getElementById('btn-submit-recurrente');
    const btnCancelarEdicion = document.getElementById('btn-cancelar-edicion');
    // --- FIN Selectores ---

    // --- Selector para Dashboard ---
    const tablaRecurrentesBody = document.getElementById('lista-recurrentes-body');
    // --- FIN Selectores ---

    // --- Selectores para el Resumen ---
    const totalIngresosEl = document.getElementById('total-ingresos');
    const totalGastosEl = document.getElementById('total-gastos');
    const totalPendienteEl = document.getElementById('total-pendiente');
    const saldoActualEl = document.getElementById('saldo-actual');
    // --- FIN Selectores ---

    // --- Selectores para Cuotas ---
    const formCuota = document.getElementById('form-cuota');
    const formCuotaMensaje = document.getElementById('form-cuota-mensaje');
    const selectCuotaCategoria = document.getElementById('cuota-categoria');
    const tablaCuotasBody = document.getElementById('lista-cuotas-body');
    const formCuotaTitulo = document.getElementById('form-cuota-titulo');
    const btnSubmitCuota = document.getElementById('btn-submit-cuota');
    const btnCancelarEdicionCuota = document.getElementById('btn-cancelar-edicion-cuota');
    // --- FIN Selectores ---

    // --- Función para resetear el formulario de recurrentes ---
    function resetFormRecurrente() {
        formRecurrente.reset(); // Limpia los campos
        formRecurrenteTitulo.textContent = 'Definir Gasto Recurrente';
        btnSubmitRecurrente.textContent = 'Guardar Recurrente';
        btnCancelarEdicion.style.display = 'none'; // Ocultar "Cancelar"
        formRecurrente.dataset.editId = ''; // Limpiar el ID de edición
        formRecurrenteMensaje.textContent = '';
    }

    // --- Función de Test de API (sin cambios) ---
    fetch('/api/test')
        .then(response => response.json())
        .then(data => {
            apiStatusDiv.innerHTML = `<p style="color: green;">${data.mensaje}</p>`;
        })
        .catch(error => {
            console.error('Error al llamar a la API de test:', error);
            apiStatusDiv.innerHTML = `<p style="color: red;">Error al conectar con la API.</p>`;
        });

    // --- === NUEVA FUNCIÓN: Cargar Categorías === ---
    function cargarCategorias() {
        fetch('/api/categorias')
            .then(response => response.json())
            .then(data => {
                // Limpiar los 3 combos
                selectCategoria.innerHTML = ''; 
                selectRecurrenteCategoria.innerHTML = '';
                selectCuotaCategoria.innerHTML = '';

                // Opciones Default
                const opcionDefault = document.createElement('option');
                opcionDefault.value = ""; 
                opcionDefault.textContent = "-- Sin Categoría --";
                selectCategoria.appendChild(opcionDefault);

                const opcionRecurrenteDefault = document.createElement('option');
                opcionRecurrenteDefault.value = ""; 
                opcionRecurrenteDefault.textContent = "-- Seleccione Categoría --";
                selectRecurrenteCategoria.appendChild(opcionRecurrenteDefault.cloneNode(true));
                selectCuotaCategoria.appendChild(opcionRecurrenteDefault.cloneNode(true));

                // Rellenar los 3 combos
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
            });
    }
    // --- === FIN FUNCIÓN === ---
    
    // --- === NUEVA LÓGICA: Formulario Plan de Cuotas === ---
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
                
                alert(data.mensaje);
                resetFormCuota();
                cargarCuotasStatus();
            })
            .catch(error => {
                console.error('Error al guardar plan de cuota:', error);
                formCuotaMensaje.textContent = `Error: ${error.message}`;
                formCuotaMensaje.style.color = 'red';
            });
        });
    }

    // --- === LÓGICA: Dashboard de Cuotas === ---
    function cargarCuotasStatus() {
        console.log("Cargando estado de planes de cuotas...");
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
                        acciones += `<button class="btn-pagar-cuota" data-id="${plan.id}" data-monto="${plan.monto_cuota}" title="Pagar Cuota">Pagar Cuota</button>`;
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
    // --- === FIN LÓGICA: Dashboard de Cuotas === ---

    // --- === LÓGICA: Manejador de Botón "Pagar Cuota" === ---
    tablaCuotasBody.addEventListener('click', (event) => {
        const target = event.target.closest('button');
        if (!target) return;

        // 1. Lógica de Pagar Cuota (sin cambios, por ahora)
        if (target.classList.contains('btn-pagar-cuota')) {
            const boton = target;
            const id = boton.dataset.id;
            const monto = boton.dataset.monto;

            if (!confirm(`¿Confirmar el pago de la cuota por ${formatearMoneda(monto)}?`)) {
                return;
            }
            boton.textContent = 'Pagando...';
            boton.disabled = true;

            fetch('/api/cuota/pagar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan_id: id })
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) { throw new Error(data.error); }
                alert(`¡Éxito! ${data.mensaje}`);
                cargarCuotasStatus();
                cargarTransacciones();
                cargarDashboardSummary();
            })
            .catch(error => {
                console.error("Error al pagar cuota:", error);
                alert(`Error: ${error.message}`);
                boton.textContent = 'Pagar Cuota';
                boton.disabled = false;
            });
        }
        
        // --- 2. NUEVA LÓGICA: Eliminar Cuota ---
        else if (target.classList.contains('btn-eliminar-cuota')) {
            const id = target.dataset.id;
            const descripcion = target.dataset.descripcion;
            
            if (confirm(`¿Estás seguro de que quieres eliminar el plan de cuotas "${descripcion}"?`)) {
                fetch(`/api/cuota/${id}`, {
                    method: 'DELETE'
                })
                .then(response => response.json())
                .then(data => {
                    if (data.error) throw new Error(data.error);
                    alert(data.mensaje);
                    cargarCuotasStatus();
                })
                .catch(error => {
                    console.error("Error al eliminar cuota:", error);
                    alert(`Error: ${error.message}`);
                });
            }
        }
        
        // --- 3. LÓGICA: Editar Cuota ---
        else if (target.classList.contains('btn-editar-cuota')) {
            const id = target.dataset.id;
            
            // 3a. Rellenar el formulario
            document.getElementById('cuota-descripcion').value = target.dataset.descripcion;
            document.getElementById('cuota-total').value = target.dataset.montoTotal;
            document.getElementById('cuota-monto').value = target.dataset.montoCuota;
            document.getElementById('cuota-total-cuotas').value = target.dataset.totalCuotas;
            document.getElementById('cuota-categoria').value = target.dataset.categoriaId;
            document.getElementById('cuota-fecha-inicio').value = target.dataset.fechaInicio; // <-- CORRECCIÓN
            
            // 3b. Poner el formulario en "Modo Edición"
            formCuotaTitulo.textContent = 'Editar Plan de Cuotas';
            btnSubmitCuota.textContent = 'Actualizar Plan';
            btnCancelarEdicionCuota.style.display = 'block';
            formCuota.dataset.editId = id;
            
            // 3c. Scroll
            formCuota.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    // --- Funciones de reseteo de formulario de cuotas ---
    function resetFormCuota() {
        formCuota.reset();
        formCuotaTitulo.textContent = 'Definir Plan de Cuotas';
        btnSubmitCuota.textContent = 'Guardar Plan';
        btnCancelarEdicionCuota.style.display = 'none';
        formCuota.dataset.editId = '';
        formCuotaMensaje.textContent = '';
    }
    // --- FIN Funciones de reseteo de formulario de cuotas ---

    btnCancelarEdicionCuota.addEventListener('click', () => {
        resetFormCuota();
    });

    // --- Lógica del Formulario ---
    if (formTransaccion) {
        formTransaccion.addEventListener('submit', (event) => {
            event.preventDefault(); 
            formMensaje.textContent = 'Enviando...';
            
            const formData = new FormData(formTransaccion);
            
            // Convertir FormData a un objeto
            const datos = {
                descripcion: formData.get('descripcion'),
                monto: formData.get('monto'),
                tipo: formData.get('tipo'),
                // --- CAMBIO ---
                // Ahora leemos 'categoria_id' del select
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
                
                // Refrescar la lista (sin cambios, pero sigue siendo importante)                
                cargarTransacciones();     // Actualiza historial
                cargarDashboardSummary();  // ¡Actualiza el resumen!
            })
            .catch(error => {
                console.error('Error al agregar transacción:', error);
                formMensaje.textContent = `Error: ${error.message}`;
                formMensaje.style.color = 'red';
            });
        });
    }


    // --- Lógica de Listado (MODIFICADA) ---
    function cargarTransacciones() {
        console.log("Cargando transacciones...");
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

                data.forEach(transaccion => {
                    const fila = document.createElement('tr');
                    
                    const estiloMonto = transaccion.tipo === 'gasto' ? 'color: red;' : 'color: green;';
                    
                    // --- CAMBIO ---
                    // Usamos 'categoria_nombre' que viene del JOIN
                    // Usamos '||' para mostrar 'N/A' si es NULL (sin categoría)
                    const categoriaTexto = transaccion.categoria_nombre || 'N/A';

                    fila.innerHTML = `
                        <td>${transaccion.fecha}</td>
                        <td>${transaccion.descripcion}</td>
                        <td>${categoriaTexto}</td> 
                        <td>${transaccion.tipo}</td>
                        <td style="${estiloMonto}">${transaccion.tipo === 'gasto' ? '-' : '+'}$${transaccion.monto}</td>
                    `;
                    
                    tablaBody.appendChild(fila);
                });
            })
            .catch(error => {
                console.error('Error al cargar transacciones:', error);
                tablaBody.innerHTML = `<tr><td colspan="5" style="color: red;">${error.message}</td></tr>`;
            });
    }

    // --- === LÓGICA: Formulario Gasto Recurrente === ---
    if (formRecurrente) {
        formRecurrente.addEventListener('submit', (event) => {
            event.preventDefault();
            formRecurrenteMensaje.textContent = 'Guardando...';
            
            const formData = new FormData(formRecurrente);
            const datos = {
                descripcion: formData.get('descripcion'),
                monto_estimado: formData.get('monto_estimado'),
                dia_vencimiento: formData.get('dia_vencimiento'),
                categoria_id: formData.get('categoria_id')
            };

            // --- CAMBIO CLAVE: Decidir si es POST (Crear) o PUT (Editar) ---
            const editId = formRecurrente.dataset.editId;
            let url = '/api/recurrente';
            let method = 'POST';

            if (editId) {
                url = `/api/recurrente/${editId}`;
                method = 'PUT';
            }
            // --- FIN CAMBIO CLAVE ---

            fetch(url, {
                method: method, // <-- 'POST' o 'PUT'
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datos)
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) { throw new Error(data.error); }
                
                alert(data.mensaje); // "Guardado..." o "Actualizado..."
                resetFormRecurrente(); // Resetea el formulario al estado original
                
                cargarRecurrentesStatus(); // Refresca la tabla
                cargarDashboardSummary();  // Refresca el resumen
            })
            .catch(error => {
                console.error('Error al guardar recurrente:', error);
                formRecurrenteMensaje.textContent = `Error: ${error.message}`;
                formRecurrenteMensaje.style.color = 'red';
            });
        });
    }
    // --- === FIN LÓGICA Formulario Gasto Recurrente === ---

    // --- === LÓGICA: Dashboard de Recurrentes === ---
    function cargarRecurrentesStatus() {
        console.log("Cargando estado de gastos recurrentes...");
        tablaRecurrentesBody.innerHTML = '<tr><td colspan="6">Cargando...</td></tr>';

        fetch('/api/recurrentes/status')
            .then(response => response.json())
            .then(data => {
                tablaRecurrentesBody.innerHTML = ''; 
                if (data.length === 0) { /* ... */ }

                data.forEach(recurrente => {
                    const fila = document.createElement('tr');
                    const estadoEstilo = recurrente.status === 'Pagado' ? 'color: green;' : 'color: orange;';
                    
                    // --- CAMBIO: Lógica de botones de acción ---
                    let acciones = '';
                    
                    // 1. Botón Pagar
                    if (recurrente.status === 'Pendiente') {
                        acciones += `<button class="btn-pagar" data-id="${recurrente.id}" data-monto-estimado="${recurrente.monto_estimado}" data-descripcion="${recurrente.descripcion}">Pagar</button>`;
                    } else {
                        acciones += `<span class="text-success">Pagado</span>`;
                    }
                    
                    // 2. Botón Editar
                    // (Añadimos toda la info del recurrente en data-attributes)
                    acciones += `
                        <button class="btn-accion btn-editar-recurrente" 
                            data-id="${recurrente.id}"
                            data-descripcion="${recurrente.descripcion}"
                            data-monto="${recurrente.monto_estimado}"
                            data-dia="${recurrente.dia_vencimiento}"
                            data-categoria-id="${recurrente.categoria_id}"
                            title="Editar">
                            ✏️
                        </button>`;

                    // 3. Botón Eliminar
                    acciones += `
                        <button class="btn-accion btn-eliminar-recurrente" 
                            data-id="${recurrente.id}"
                            data-descripcion="${recurrente.descripcion}"
                            title="Eliminar">
                            ❌
                        </button>`;
                    
                    // --- FIN CAMBIO ---

                    fila.innerHTML = `
                        <td>${recurrente.descripcion}</td>
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

    // --- === LÓGICA: Manejador de Botón "Pagar" === ---
    
    // Usamos "delegación de eventos". Escuchamos clics en la
    // tabla (que siempre existe), en lugar de en los botones
    // (que son dinámicos y se crean/borran).
    tablaRecurrentesBody.addEventListener('click', (event) => {
        const target = event.target.closest('button'); // Busca el botón más cercano al clic
        if (!target) return; // Si no se hizo clic en un botón, salir

        // 1. Lógica de Pagar
        if (target.classList.contains('btn-pagar')) {
            const boton = target;
            const id = boton.dataset.id;
            const montoEstimado = boton.dataset.montoEstimado;
            const descripcion = boton.dataset.descripcion;

            // 1a. Pedir el monto real.
            const montoPagado = prompt(
                `¿Confirmar pago de "${descripcion}"?\nIntroduce el monto pagado (estimado ${formatearMoneda(montoEstimado)}):`, 
                montoEstimado
            );

            // 1b. Validar
            if (montoPagado === null) {
                return; // Usuario canceló
            }
            if (isNaN(montoPagado) || montoPagado <= 0) {
                alert("Monto inválido. El pago no se registró.");
                return;
            }

            // 1c. Enviar a la API de "pagar"
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
                
                alert(`¡Éxito! ${data.mensaje}`);

                // 1d. Refrescar TODO
                cargarRecurrentesStatus();
                cargarTransacciones();     
                cargarDashboardSummary(); 
            })
            .catch(error => {
                console.error("Error al pagar:", error);
                alert(`Error: ${error.message}`);
                boton.textContent = 'Pagar';
                boton.disabled = false;
            });
        } 
        
        // --- 2. LÓGICA: Eliminar ---
        else if (target.classList.contains('btn-eliminar-recurrente')) {
            const id = target.dataset.id;
            const descripcion = target.dataset.descripcion;
            
            if (confirm(`¿Estás seguro de que quieres eliminar el gasto recurrente "${descripcion}"?`)) {
                fetch(`/api/recurrente/${id}`, {
                    method: 'DELETE'
                })
                .then(response => response.json())
                .then(data => {
                    if (data.error) throw new Error(data.error);
                    
                    alert(data.mensaje); // "Gasto recurrente eliminado..."
                    cargarRecurrentesStatus();
                    cargarDashboardSummary(); // Actualiza el total de "Pendiente"
                })
                .catch(error => {
                    console.error("Error al eliminar:", error);
                    alert(`Error: ${error.message}`);
                });
            }
        }
        
        // --- 3. LÓGICA: Editar ---
        else if (target.classList.contains('btn-editar-recurrente')) {
            const id = target.dataset.id;
            
            // 3a. Rellenar el formulario con los datos del botón
            document.getElementById('recurrente-descripcion').value = target.dataset.descripcion;
            document.getElementById('recurrente-monto').value = target.dataset.monto;
            document.getElementById('recurrente-dia').value = target.dataset.dia;
            document.getElementById('recurrente-categoria').value = target.dataset.categoriaId;
            
            // 3b. Poner el formulario en "Modo Edición"
            formRecurrenteTitulo.textContent = 'Editar Gasto Recurrente';
            btnSubmitRecurrente.textContent = 'Actualizar Cambios';
            btnCancelarEdicion.style.display = 'block'; // Mostrar botón "Cancelar"
            
            // 3c. Guardar el ID que estamos editando en el formulario
            formRecurrente.dataset.editId = id;
            
            // 3d. (Opcional) Llevar la vista al formulario
            formRecurrente.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });

    // Helper para formatear números como moneda
    function formatearMoneda(numero) {
        return new Intl.NumberFormat('es-AR', { 
            style: 'currency', 
            currency: 'ARS' 
        }).format(numero);
    }

    function cargarDashboardSummary() {
        console.log("Cargando resumen del dashboard...");
        
        fetch('/api/dashboard/summary')
            .then(response => {
                if (!response.ok) { throw new Error('Error al cargar resumen'); }
                return response.json();
            })
            .then(data => {
                console.log("Resumen recibido:", data);
                
                // Rellenar las tarjetas con los datos formateados
                totalIngresosEl.textContent = formatearMoneda(data.total_ingresos);
                totalGastosEl.textContent = formatearMoneda(data.total_gastos);
                totalPendienteEl.textContent = formatearMoneda(data.total_pendiente);
                saldoActualEl.textContent = formatearMoneda(data.saldo_actual);
                
                // Opcional: Cambiar color del saldo si es negativo
                saldoActualEl.style.color = data.saldo_actual < 0 ? 'red' : 'blue';
            })
            .catch(error => {
                console.error(error);
                totalIngresosEl.textContent = "Error";
                totalGastosEl.textContent = "Error";
                totalPendienteEl.textContent = "Error";
                saldoActualEl.textContent = "Error";
            });
    }
    // --- === FIN FUNCIÓN === ---

    // --- LLAMADAS INICIALES AL CARGAR LA PÁGINA ---
    cargarCategorias();     
    cargarTransacciones();  
    cargarRecurrentesStatus();
    cargarDashboardSummary(); // FUNCIÓN DEL RESUMEN
    cargarCuotasStatus(); // carga cuotas
});