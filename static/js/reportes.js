document.addEventListener('DOMContentLoaded', () => {
    console.log("Cargando módulo de reportes...");

    // Selectores
    const formFiltros = document.getElementById('form-filtros');
    const selCategoria = document.getElementById('f-categoria');
    const tablaBody = document.getElementById('body-resultados');
    const totalEl = document.getElementById('total-filtrado');
    const ctx = document.getElementById('miGrafico').getContext('2d');

    // Variable global para el gráfico (para poder destruirlo y recrearlo)
    let chartInstance = null;

    // 1. Cargar Categorías al iniciar
    fetch('/api/categorias')
        .then(r => r.json())
        .then(data => {
            data.forEach(c => {
                const op = document.createElement('option');
                op.value = c.id;
                op.textContent = c.nombre;
                selCategoria.appendChild(op);
            });
        });

    // 2. Manejar el filtro
    formFiltros.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = new FormData(formFiltros);
        const datos = Object.fromEntries(formData.entries());

        // Limpiar tabla y mostrar cargando
        tablaBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando...</td></tr>';

        fetch('/api/reportes/filtrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        })
        .then(r => r.json())
        .then(transacciones => {
            renderizarTabla(transacciones);
            renderizarGrafico(transacciones);
        })
        .catch(err => {
            console.error(err);
            tablaBody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center;">Error al cargar datos.</td></tr>';
        });
    });

    // 3. Renderizar Tabla
    function renderizarTabla(datos) {
        tablaBody.innerHTML = '';
        let sumaTotal = 0;

        if (datos.length === 0) {
            tablaBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No se encontraron movimientos con esos filtros.</td></tr>';
            totalEl.textContent = "$0.00";
            return;
        }

        datos.forEach(t => {
            const tr = document.createElement('tr');
            // Formato fecha
            const f = t.fecha.split('-'); 
            const fechaStr = `${f[2]}/${f[1]}/${f[0]}`;
            
            // Formato moneda
            const montoStr = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(t.monto);
            
            const color = t.tipo === 'gasto' ? 'red' : 'green';
            
            // Sumar (restando gastos si se muestran mezclados, o sumando valor absoluto)
            // Para reportes, generalmente sumamos el VALOR de lo filtrado
            sumaTotal += t.monto;

            tr.innerHTML = `
                <td>${fechaStr}</td>
                <td>${t.descripcion}</td>
                <td>${t.categoria_nombre || 'N/A'}</td>
                <td>${t.tipo}</td>
                <td style="color:${color}">${montoStr}</td>
            `;
            tablaBody.appendChild(tr);
        });

        totalEl.textContent = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(sumaTotal);
    }

    // 4. Renderizar Gráfico de Torta
    function renderizarGrafico(datos) {
        // A. Agrupar datos por categoría
        const agrupado = {};
        
        datos.forEach(t => {
            const cat = t.categoria_nombre || 'Sin Categoría';
            if (!agrupado[cat]) agrupado[cat] = 0;
            agrupado[cat] += t.monto;
        });

        // B. Preparar arrays para Chart.js
        const labels = Object.keys(agrupado);
        const valores = Object.values(agrupado);

        // C. Destruir gráfico anterior si existe
        if (chartInstance) {
            chartInstance.destroy();
        }

        // D. Crear nuevo gráfico
        chartInstance = new Chart(ctx, {
            type: 'pie', // Tipo torta
            data: {
                labels: labels,
                datasets: [{
                    label: 'Monto',
                    data: valores,
                    backgroundColor: [
                        '#3498db', '#e74c3c', '#f1c40f', '#2ecc71', '#9b59b6', 
                        '#34495e', '#1abc9c', '#e67e22', '#95a5a6'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    title: {
                        display: true,
                        text: 'Distribución por Categoría'
                    }
                }
            }
        });
    }
    
    // Cargar datos iniciales (últimos 30 días por defecto o todos)
    // Disparamos el evento submit manualmente para cargar algo al inicio
    formFiltros.dispatchEvent(new Event('submit'));
});