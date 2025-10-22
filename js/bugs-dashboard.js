import { db } from './firebase-config.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

let chartEstados, chartSeveridad;

document.getElementById('formFiltros').addEventListener('submit', (e) => {
    e.preventDefault();
    cargarDatos();
});

document.getElementById('btnRefrescar').addEventListener('click', () => cargarDatos());
window.addEventListener('DOMContentLoaded', () => cargarDatos());

async function cargarDatos() {
    const bugsRef = collection(db, 'bugs');
    const snap = await getDocs(bugsRef);
    let bugs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 📅 Aplicar filtros
    const inicio = document.getElementById('fechaInicio').value;
    const fin = document.getElementById('fechaFin').value;
    const estado = document.getElementById('filtroEstado').value;
    const severidad = document.getElementById('filtroSeveridad').value;

    bugs = bugs.filter(b => {
        let valido = true;

        if (inicio && b.Fecha?.toDate) {
            valido = valido && b.Fecha.toDate() >= new Date(inicio);
        }
        if (fin && b.Fecha?.toDate) {
            const fechaFin = new Date(fin);
            fechaFin.setHours(23, 59, 59);
            valido = valido && b.Fecha.toDate() <= fechaFin;
        }
        if (estado) valido = valido && b.Estado === estado;
        if (severidad) valido = valido && b.Severidad === severidad;

        return valido;
    });

    actualizarKPIs(bugs);
    actualizarGraficas(bugs);
}

function actualizarKPIs(bugs) {
    const total = bugs.length;
    const abiertos = bugs.filter(b => b.Estado === 'Abierto').length;
    const progreso = bugs.filter(b => b.Estado === 'En progreso').length;
    const resueltos = bugs.filter(b => ['Resuelto', 'Cerrado'].includes(b.Estado)).length;

    document.getElementById('totalBugs').textContent = total;
    document.getElementById('bugsAbiertos').textContent = abiertos;
    document.getElementById('bugsProgreso').textContent = progreso;
    document.getElementById('bugsResueltos').textContent = resueltos;
}

function actualizarGraficas(bugs) {
    const estados = ['Abierto', 'En progreso', 'Resuelto', 'Cerrado'];
    const countsEstado = estados.map(e => bugs.filter(b => b.Estado === e).length);

    const severidades = ['Baja', 'Media', 'Alta', 'Crítica'];
    const countsSeveridad = severidades.map(s => bugs.filter(b => b.Severidad === s).length);

    renderChartEstados(estados, countsEstado);
    renderChartSeveridad(severidades, countsSeveridad);
}

function renderChartEstados(labels, data) {
    const ctx = document.getElementById('chartEstados').getContext('2d');
    if (chartEstados) chartEstados.destroy();
    chartEstados = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: ['#dc3545', '#ffc107', '#198754', '#6c757d']
            }]
        },
        options: { plugins: { legend: { position: 'bottom' } } }
    });
}

function renderChartSeveridad(labels, data) {
    const ctx = document.getElementById('chartSeveridad').getContext('2d');
    if (chartSeveridad) chartSeveridad.destroy();
    chartSeveridad = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data,
                label: 'Cantidad',
                backgroundColor: ['#0dcaf0', '#0d6efd', '#ffc107', '#dc3545']
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });
}
