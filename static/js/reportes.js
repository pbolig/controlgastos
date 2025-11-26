document.addEventListener('DOMContentLoaded', () => {
    console.log("Cargando módulo de reportes v2...");

    // --- SELECTORES ---
    const formFiltros = document.getElementById('form-filtros');
    const selCategoria = document.getElementById('f-categoria');
    const tablaBody = document.getElementById('body-resultados');
    const totalEl = document.getElementById('total-filtrado');
    const canvas = document.getElementById('miGrafico');
    const ctx = canvas.getContext('2d');

    let chartInstance = null;

    // --- 1. CARGAR CATEGORÍAS EN EL FILTRO ---
    fetch('/api/categorias')
        .then(r => r.json())
        .then(data => {
            selCategoria.innerHTML = '<option value="">Todas</option>';
            data.forEach(c => {
                const op = document.createElement('option');
                op.value = c.id;
                op.textContent = c.nombre;
                selCategoria.appendChild(op);
            });
        })
        .catch(err => console.error("Error cargando categorías:", err));

    // --- 2. MANEJAR EL FILTRADO ---
    formFiltros.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = new FormData(formFiltros);
        const datos = Object.fromEntries(formData.entries());

        tablaBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando datos...</td></tr>';

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
            tablaBody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center;">Error al cargar reporte.</td></tr>';
        });
    });

    // --- 3. RENDERIZAR TABLA ---
    function renderizarTabla(datos) {
        tablaBody.innerHTML = '';
        let balanceTotal = 0;

        if (datos.length === 0) {
            tablaBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#777;">No se encontraron movimientos con estos filtros.</td></tr>';
            totalEl.textContent = "$0.00";
            if (chartInstance) chartInstance.destroy(); // Limpiar gráfico si no hay datos
            return;
        }

        datos.forEach(t => {
            const tr = document.createElement('tr');
            
            // Formatear Fecha (YYYY-MM-DD -> DD/MM/YYYY)
            const f = t.fecha.split('-'); 
            const fechaStr = `${f[2]}/${f[1]}/${f[0]}`;
            
            // Formatear Monto
            const montoStr = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(t.monto);
            
            // Estilos según tipo
            const esGasto = t.tipo === 'gasto';
            const color = esGasto ? '#e74c3c' : '#2ecc71'; // Rojo o Verde
            const signo = esGasto ? '-' : '+';
            
            // Cálculo del Balance (Ingresos suman, Gastos restan)
            if (esGasto) {
                balanceTotal -= t.monto;
            } else {
                balanceTotal += t.monto;
            }

            tr.innerHTML = `
                <td>${fechaStr}</td>
                <td>${t.descripcion}</td>
                <td>${t.categoria_nombre || 'N/A'}</td>
                <td style="text-transform: capitalize;">${t.tipo}</td>
                <td style="color:${color}; font-weight:500;">${signo}${montoStr}</td>
            `;
            tablaBody.appendChild(tr);
        });

        // Mostrar Total
        const colorTotal = balanceTotal < 0 ? 'red' : 'blue';
        totalEl.style.color = colorTotal;
        totalEl.textContent = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(balanceTotal);
    }

    // --- 4. RENDERIZAR GRÁFICO DE TORTA ---
    function renderizarGrafico(datos) {
        // Solo graficamos GASTOS para ver la distribución del dinero que sale
        const agrupado = {};
        let hayGastos = false;
        
        datos.forEach(t => {
            if (t.tipo === 'gasto') {
                const cat = t.categoria_nombre || 'Otros';
                if (!agrupado[cat]) agrupado[cat] = 0;
                agrupado[cat] += t.monto;
                hayGastos = true;
            }
        });

        // Limpiar gráfico anterior
        if (chartInstance) {
            chartInstance.destroy();
        }

        if (!hayGastos) return; // Si solo hay ingresos, no mostramos torta de gastos

        const labels = Object.keys(agrupado);
        const valores = Object.values(agrupado);

        chartInstance = new Chart(ctx, {
            type: 'doughnut', // Tipo "Dona" (más moderno que Pie)
            data: {
                labels: labels,
                datasets: [{
                    data: valores,
                    backgroundColor: [
                        '#3498db', '#e74c3c', '#f1c40f', '#9b59b6', '#2ecc71', 
                        '#34495e', '#1abc9c', '#e67e22', '#95a5a6', '#7f8c8d'
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
                        labels: { boxWidth: 15, font: { size: 11 } }
                    },
                    title: {
                        display: true,
                        text: 'Distribución de Gastos',
                        font: { size: 14 }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) { label += ': '; }
                                if (context.parsed !== null) {
                                    label += new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(context.parsed);
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Cargar datos iniciales (simula clic en Filtrar al abrir la página)
    formFiltros.dispatchEvent(new Event('submit'));
});