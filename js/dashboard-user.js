import { auth, db } from './firebase-config.js';
import {
  collection,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';

let chartCasos = null;
let chartBugs = null;

// 📊 Totales generales
async function cargarTotales() {
  const appsSnap = await getDocs(collection(db, 'apps'));
  const bugsSnap = await getDocs(collection(db, 'bugs'));
  const usersSnap = await getDocs(collection(db, 'users'));
  const dispositivosSnap = await getDocs(collection(db, 'dispositivos'));

  const dispositivosOk = dispositivosSnap.docs.filter(d => d.data().estado !== 'Dañado').length;
  const bugsAbiertos = bugsSnap.docs.filter(b => b.data().estado === 'Abierto').length;
  const activos = usersSnap.docs.filter(u => u.data().status === 'Activo').length;

  document.getElementById('totalApps').textContent = appsSnap.size;
  document.getElementById('dispositivosOk').textContent = dispositivosOk;
  document.getElementById('bugsAbiertos').textContent = bugsAbiertos;
  document.getElementById('usuariosActivos').textContent = activos;
}

// 📈 Gráfico de Casos — recorre apps ➜ matrices ➜ casos
async function generarGraficoCasos() {
  const appsSnap = await getDocs(collection(db, 'apps'));
  const resumen = {};
  let totalCasos = 0;

  // 🔁 Recorrer app ➜ módulo ➜ matrices ➜ casos
  for (const appDoc of appsSnap.docs) {
    const modulosRef = collection(db, `apps/${appDoc.id}/modulos`);
    const modulosSnap = await getDocs(modulosRef);

    for (const moduloDoc of modulosSnap.docs) {
      const matricesRef = collection(db, `apps/${appDoc.id}/modulos/${moduloDoc.id}/matrices`);
      const matricesSnap = await getDocs(matricesRef);

      for (const matrizDoc of matricesSnap.docs) {
        const casosRef = collection(db, `apps/${appDoc.id}/modulos/${moduloDoc.id}/matrices/${matrizDoc.id}/casos`);
        const casosSnap = await getDocs(casosRef);
        totalCasos += casosSnap.size;
      }
    }
  }

  
  const labels = Object.keys(resumen);
  const data = Object.values(resumen);
  const noDataMsg = document.getElementById('noDataMsg');
  const canvas = document.getElementById('chartCasos');

  if (data.length === 0) {
    canvas.classList.add('d-none');
    noDataMsg.classList.remove('d-none');
    return;
  } else {
    canvas.classList.remove('d-none');
    noDataMsg.classList.add('d-none');
  }

  const ctx = canvas.getContext('2d');
  if (chartCasos) chartCasos.destroy();

  chartCasos = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: ['#0d6efd', '#198754', '#ffc107', '#dc3545', '#6c757d'],
        borderColor: '#A3D3F5',
        borderWidth: 2
      }]
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        title: { display: false }
      }
    }
  });
}


// 📊 Gráfico de Bugs
async function generarGraficoBugs() {
  const bugsSnap = await getDocs(collection(db, 'bugs'));
  const conteo = {};

  bugsSnap.forEach((b) => {
    const estado = b.data().estado || 'Desconocido';
    conteo[estado] = (conteo[estado] || 0) + 1;
  });

  const labels = Object.keys(conteo);
  const data = Object.values(conteo);
  const ctx = document.getElementById('chartBugs').getContext('2d');

  if (chartBugs) chartBugs.destroy();

  chartBugs = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Cantidad de Bugs',
        data,
        backgroundColor: ['#dc3545', '#ffc107', '#0d6efd', '#198754', '#6c757d'],
        borderColor: '#A3D3F5',
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#23223F', titleColor: '#fff' }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: '#23223F', stepSize: 1 },
          grid: { color: 'rgba(0,0,0,0.08)' }
        },
        x: {
          ticks: { color: '#23223F' },
          grid: { display: false }
        }
      }
    }
  });
}

// 🔁 Cargar Dashboard completo
async function cargarDashboard() {
  Swal.showLoading();
  await cargarTotales();
  await generarGraficoCasos();
  await generarGraficoBugs();
  Swal.close();
}

// 🚀 Inicio
onAuthStateChanged(auth, (user) => {
  if (!user) {
    Swal.fire({
      icon: 'warning',
      title: 'Sesión expirada',
      text: 'Por favor inicia sesión nuevamente.',
      confirmButtonColor: '#23223F'
    }).then(() => (window.location.href = 'index.html'));
  } else {
    cargarDashboard();
  }
});

document.getElementById('refreshBtn').addEventListener('click', cargarDashboard);

