import { db, auth } from './firebase-config.js';
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  orderBy
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';

// Esperar a que window.currentUser esté disponible
function waitForUser() {
  return new Promise(resolve => {
    const interval = setInterval(() => {
      if (window.currentUser && window.currentUser.email) {
        clearInterval(interval);
        resolve(window.currentUser);
      }
    }, 300);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const proyectosActivosEl = document.getElementById('proyectosActivos');
  const bugsAbiertosEl = document.getElementById('bugsAbiertos');
  const casosAprobadosEl = document.getElementById('casosAprobados');
  const usuariosActivosEl = document.getElementById('usuariosActivos');
  const tablaProyectosBody = document.querySelector('#tablaProyectos tbody');
  const chartCanvas = document.getElementById('chartEstatus');
  const refreshBtn = document.getElementById('refreshBtn');

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    const current = await waitForUser();
    await refrescarDashboard(user, current);
  });

  // 🔁 Botón para actualizar datos sin recargar página
  refreshBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;
    const current = await waitForUser();

    refreshBtn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Actualizando...`;
    refreshBtn.disabled = true;

    await refrescarDashboard(user, current);

    setTimeout(() => {
      refreshBtn.innerHTML = `<i class="bi bi-arrow-clockwise"></i> Actualizar Datos`;
      refreshBtn.disabled = false;
    }, 1000);
  });

  // ======================================
  // 🔹 Función principal para actualizar dashboard
  // ======================================
  async function refrescarDashboard(user, current) {
    try {
      // 1️⃣ Proyectos activos
      const matricesQ = query(collection(db, 'matrices'), where('tester', '==', user.email));
      const matricesSnap = await getDocs(matricesQ);
      proyectosActivosEl.textContent = matricesSnap.size || 0;

      // 2️⃣ Bugs abiertos
      const bugsQ = query(collection(db, 'bugs'), where('estatus', 'in', ['Abierto', 'En progreso']));
      const bugsSnap = await getDocs(bugsQ);
      bugsAbiertosEl.textContent = bugsSnap.size || 0;

      // 3️⃣ Casos aprobados
      const casosQ = query(collection(db, 'casos'), where('estatus', '==', 'Positivo'));
      const casosSnap = await getDocs(casosQ);
      casosAprobadosEl.textContent = casosSnap.size || 0;

      // 4️⃣ Usuarios activos
      if (current.role === 'Admin') {
        const usersSnap = await getDocs(collection(db, 'users'));
        const activos = usersSnap.docs.filter(d => d.data().status === 'Activo').length;
        usuariosActivosEl.textContent = activos;
      } else {
        usuariosActivosEl.textContent = '-';
      }

      // 5️⃣ Proyectos recientes
      await cargarProyectosRecientes(user.email, tablaProyectosBody);

      // 6️⃣ Gráfico de casos
      await generarGraficoCasos(chartCanvas);
    } catch (error) {
      console.error('❌ Error actualizando dashboard:', error);
    }
  }
});

// ==========================
// 🧩 Función: Proyectos recientes
// ==========================
async function cargarProyectosRecientes(email, tablaBody) {
  try {
    const q = query(
      collection(db, 'matrices'),
      where('tester', '==', email),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const snapshot = await getDocs(q);

    tablaBody.innerHTML = '';
    if (snapshot.empty) {
      tablaBody.innerHTML = `
        <tr><td colspan="6" class="text-center text-muted">No hay proyectos recientes</td></tr>`;
      return;
    }

    let index = 1;
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const avance = calcularAvance();
      const estado = `<span class="badge bg-${avance < 30 ? 'warning text-dark' : avance < 70 ? 'info' : 'success'
        }">
        ${avance < 30 ? 'Pendiente' : avance < 70 ? 'En curso' : 'Completado'}
      </span>`;

      const row = `
        <tr>
          <td>${index++}</td>
          <td>${data.nombre || 'Sin nombre'}</td>
          <td>${estado}</td>
          <td>${data.bugsCount || 0}</td>
          <td>
            <div class="progress" style="height: 8px;">
              <div class="progress-bar bg-${avance < 30 ? 'warning' : avance < 70 ? 'info' : 'success'
        }" style="width: ${avance}%"></div>
            </div>
          </td>
          <td>
            <a href="casos.html?id=${docSnap.id}&nombre=${encodeURIComponent(data.nombre)}"
               class="btn btn-sm btn-outline-primary">Ver</a>
          </td>
        </tr>`;
      tablaBody.insertAdjacentHTML('beforeend', row);
    });
  } catch (error) {
    console.error('❌ Error al cargar proyectos recientes:', error);
  }
}

// Simulación temporal del % de avance
function calcularAvance() {
  return Math.floor(Math.random() * 100);
}

// ==========================
// 📊 Generar gráfico dinámico
// ==========================
async function generarGraficoCasos(canvas) {
  try {
    const snapshot = await getDocs(collection(db, 'casos'));
    if (snapshot.empty) return;

    const conteo = {
      Positivo: 0,
      Fallo: 0,
      Bloqueado: 0,
      Pendiente: 0,
      'N/A': 0
    };

    snapshot.forEach(doc => {
      const estatus = doc.data().estatus || 'Pendiente';
      if (conteo[estatus] !== undefined) conteo[estatus]++;
    });

    const labels = Object.keys(conteo);
    const data = Object.values(conteo);
    const backgroundColors = ['#28a745', '#dc3545', '#ffc107', '#0d6efd', '#6c757d'];

    if (window.chartInstance) window.chartInstance.destroy();

    window.chartInstance = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: backgroundColors, borderWidth: 1 }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 14 } } }
        }
      }
    });
  } catch (error) {
    console.error('❌ Error generando gráfico:', error);
  }
}
