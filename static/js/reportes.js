document.addEventListener('DOMContentLoaded', () => {
    console.log("Cargando módulo de reportes v2...");

    // --- SELECTORES ---
    const formFiltros = document.getElementById('form-filtros');
    const selCategoria = document.getElementById('f-categoria');
    const tablaBody = document.getElementById('body-resultados');
    const totalEl = document.getElementById('total-filtrado');
    const canvas = document.getElementById('miGrafico');
    const divControlesGrafico = document.querySelector('.grafico-controles');
    const ctx = canvas.getContext('2d');

    let chartInstance = null;
    let transaccionesActuales = []; // Guardamos los datos para no volver a pedirlos

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
            transaccionesActuales = transacciones; // Guardamos los datos
            renderizarGrafico(); // Renderizamos con la moneda seleccionada por defecto
        })
        .catch(err => {
            console.error(err);
            tablaBody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center;">Error al cargar reporte.</td></tr>';
        });
    });

    // --- NUEVO: Escuchar cambios en el selector de moneda del gráfico ---
    divControlesGrafico.addEventListener('change', () => {
        renderizarGrafico(); // Volver a dibujar el gráfico con la nueva moneda
    });

    // --- Función auxiliar para formatear moneda ---
    function formatearMoneda(numero, moneda = 'ARS') {
        const num = parseFloat(numero);
        if (isNaN(num)) return "$0.00";
        const currencyCode = moneda.toUpperCase() === 'USD' ? 'USD' : 'ARS';
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: currencyCode }).format(num);
    }

    // --- 3. RENDERIZAR TABLA ---
    function renderizarTabla(datos) {
        tablaBody.innerHTML = '';
        let balanceTotalARS = 0, balanceTotalUSD = 0;

        if (datos.length === 0) {
            tablaBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#777;">No se encontraron movimientos con estos filtros.</td></tr>';
            totalEl.textContent = formatearMoneda(0, 'ARS');
            if (chartInstance) chartInstance.destroy(); // Limpiar gráfico si no hay datos
            return;
        }

        datos.forEach(t => {
            const tr = document.createElement('tr');
            
            // Formatear Fecha (YYYY-MM-DD -> DD/MM/YYYY)
            const f = t.fecha.split('-'); 
            const fechaStr = `${f[2]}/${f[1]}/${f[0]}`;
            
            // Formatear Monto
            const montoStr = formatearMoneda(t.monto, t.moneda);
            
            // Estilos según tipo
            const esGasto = t.tipo === 'gasto';
            const color = esGasto ? '#e74c3c' : '#2ecc71'; // Rojo o Verde
            const signo = esGasto ? '-' : '+';
            
            // Cálculo del Balance por moneda
            if (t.moneda === 'USD') {
                balanceTotalUSD += esGasto ? -t.monto : t.monto;
            } else {
                balanceTotalARS += esGasto ? -t.monto : t.monto;
            }

            tr.innerHTML = `
                <td>${fechaStr}</td>
                <td>${t.descripcion}</td>
                <td>${t.categoria_nombre || 'N/A'}</td>
                <td style="text-transform: capitalize;">${t.tipo} (${t.moneda})</td>
                <td style="color:${color}; font-weight:500;">${signo}${montoStr}</td>
            `;
            tablaBody.appendChild(tr);
        });

        // Mostrar Total
        const totalArsStr = formatearMoneda(balanceTotalARS, 'ARS');
        const totalUsdStr = formatearMoneda(balanceTotalUSD, 'USD');
        totalEl.innerHTML = `<span style="color:${balanceTotalARS < 0 ? 'red' : 'blue'}">${totalArsStr}</span> / <span style="color:${balanceTotalUSD < 0 ? 'red' : 'green'}">${totalUsdStr}</span>`;
    }

    // --- 4. RENDERIZAR GRÁFICO DE TORTA ---
    function renderizarGrafico() {
        // Leemos la moneda seleccionada en los radio buttons
        const monedaSeleccionada = document.querySelector('input[name="grafico-moneda"]:checked').value;

        // Solo graficamos GASTOS para ver la distribución del dinero que sale
        const agrupado = {};
        let hayGastos = false;
        
        transaccionesActuales.forEach(t => {
            // Filtramos por tipo 'gasto' Y por la moneda seleccionada
            if (t.tipo === 'gasto' && t.moneda === monedaSeleccionada) {
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

        if (!hayGastos) {
            canvas.style.display = 'none'; // Ocultamos el canvas si no hay datos
            return;
        } else { canvas.style.display = 'block'; }

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
                        text: `Distribución de Gastos (${monedaSeleccionada})`,
                        font: { size: 14 }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) { label += ': '; }
                                if (context.parsed !== null) {
                                    label += formatearMoneda(context.parsed, monedaSeleccionada);
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