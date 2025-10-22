// /js/firestore-utils.js
import { db } from './firebase-config.js';
import {
    collection, query, where, getDocs, limit, orderBy
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

export async function getDashboardMetrics(user) {
    let proyectosActivos = 0, bugsAbiertos = 0, casosAprobados = 0, usuariosActivos = null;

    // 🔹 Proyectos asignados (matrices)
    const matricesQ = query(collection(db, 'matrices'), where('tester', '==', user.email));
    const matricesSnap = await getDocs(matricesQ);
    proyectosActivos = matricesSnap.size;

    // 🔹 Bugs abiertos o en progreso
    const bugsQ = query(collection(db, 'bugs'), where('estatus', 'in', ['Abierto', 'En progreso']));
    const bugsSnap = await getDocs(bugsQ);
    bugsAbiertos = bugsSnap.size;

    // 🔹 Casos aprobados
    const casosQ = query(collection(db, 'casos'), where('estatus', '==', 'Positivo'));
    const casosSnap = await getDocs(casosQ);
    casosAprobados = casosSnap.size;

    // 🔹 Usuarios activos solo si es Admin/Supervisor
    if (['Administrador', 'Supervisor'].includes(user.role)) {
        const usersSnap = await getDocs(collection(db, 'users'));
        usuariosActivos = usersSnap.docs.filter(d => d.data().status === 'Activo').length;
    }

    return { proyectosActivos, bugsAbiertos, casosAprobados, usuariosActivos };
}

export async function getRecentProjects(user) {
    const q = query(
        collection(db, 'matrices'),
        where('tester', '==', user.email),
        orderBy('createdAt', 'desc'),
        limit(5)
    );
    const snapshot = await getDocs(q);
    const proyectos = [];

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const avance = Math.floor(Math.random() * 100); // Simulado, reemplázalo con cálculo real
        const estadoColor = avance < 30 ? 'warning' : avance < 70 ? 'info' : 'success';
        const estadoTexto = avance < 30 ? 'Pendiente' : avance < 70 ? 'En curso' : 'Completado';
        proyectos.push({
            id: docSnap.id,
            nombre: data.nombre || 'Sin nombre',
            avance,
            estadoColor,
            estadoTexto,
            bugs: data.bugsCount || 0
        });
    });

    return proyectos;
}

export async function getCaseSummary(canvas) {
    const snapshot = await getDocs(collection(db, 'casos'));
    const conteo = { Positivo: 0, Fallo: 0, Bloqueado: 0, Pendiente: 0, 'N/A': 0 };

    snapshot.forEach(doc => {
        const e = doc.data().estatus || 'Pendiente';
        if (conteo[e] !== undefined) conteo[e]++;
    });

    const labels = Object.keys(conteo);
    const data = Object.values(conteo);
    const colors = ['#28a745', '#dc3545', '#ffc107', '#0d6efd', '#6c757d'];

    if (window.chartInstance) window.chartInstance.destroy();
    window.chartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors }] },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { font: { size: 14 } } }
            }
        }
    });
}
