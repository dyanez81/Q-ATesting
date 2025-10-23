import { auth, db } from './firebase-config.js';
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    doc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';

// Elementos
const tabla = document.querySelector('#tablaApps tbody');
const formApp = document.getElementById('formApp');
const modalApp = document.getElementById('modalApp');
const modalEl = document.getElementById('modalApp');
const testerSelect = document.getElementById('testerApp');
let apps = [];
let editId = null;

// --- Cargar testers ---
async function cargarTesters() {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    testerSelect.innerHTML = '<option value="">Seleccionar Tester</option>';

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.role === 'Tester') {
            const opt = document.createElement('option');
            opt.value = docSnap.id;
            opt.textContent = data.name || data.email;
            testerSelect.appendChild(opt);
        }
    });
}

// --- Cargar Apps ---
async function cargarApps() {
    const appsRef = collection(db, 'apps');
    const snapshot = await getDocs(appsRef);
    apps = [];
    tabla.innerHTML = '';

    let index = 1;
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        apps.push({ id: docSnap.id, ...data });

        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td>${index++}</td>
      <td>${data.nombre || ''}</td>
      <td>${data.tipo || ''}</td>
      <td>${data.testerNombre || ''}</td>
      <td>${data.requerimiento || ''}</td>
      <td>${data.fechaFin || ''}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary me-1" data-id="${docSnap.id}" data-action="edit">
          <i class="bi bi-pencil"></i>
        </button>
      </td>
    `;
        tabla.appendChild(tr);
    });
}

// --- Guardar App ---
formApp.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('nombreApp').value.trim();
    const tipo = document.getElementById('tipoApp').value;
    const tester = document.getElementById('testerApp').value;
    const requerimiento = document.getElementById('requerimientoApp').value.trim();
    const fechaFin = document.getElementById('fechaFinApp').value;

    if (!nombre || !tipo || !tester) {
        Swal.fire('Error', 'Por favor completa los campos obligatorios.', 'error');
        return;
    }

    const testerDoc = await getDoc(doc(db, 'users', tester));
    const testerNombre = testerDoc.exists() ? (testerDoc.data().name || testerDoc.data().email) : '';

    try {
        if (editId) {
            const ref = doc(db, 'apps', editId);
            await updateDoc(ref, { nombre, tipo, tester, testerNombre, requerimiento, fechaFin });
            Swal.fire('Actualizado', 'La aplicación se actualizó correctamente.', 'success');
        } else {
            await addDoc(collection(db, 'apps'), { nombre, tipo, tester, testerNombre, requerimiento, fechaFin });
            Swal.fire('Guardado', 'La aplicación se registró correctamente.', 'success');
        }

        document.getElementById('modalApp').querySelector('.btn-close').click();
        formApp.reset();
        editId = null;
        cargarApps();
    } catch (err) {
        console.error('Error al guardar app:', err);
        Swal.fire('Error', 'No se pudo guardar la aplicación.', 'error');
    }
});

// --- Detectar edición ---
tabla.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action="edit"]');
    if (!btn) return;

    const id = btn.getAttribute('data-id');
    const app = apps.find(a => a.id === id);
    if (!app) return;

    editId = id;
    document.getElementById('nombreApp').value = app.nombre || '';
    document.getElementById('tipoApp').value = app.tipo || '';
    document.getElementById('testerApp').value = app.tester || '';
    document.getElementById('requerimientoApp').value = app.requerimiento || '';
    document.getElementById('fechaFinApp').value = app.fechaFin || '';

    const modal = new bootstrap.Modal(document.getElementById('modalApp'));
    modal.show();
});
// 🧩 Resetear modal cuando se abre para nuevo usuario
modalEl.addEventListener('show.bs.modal', () => {
    if (!editando) {
        modalTitle.textContent = 'Registrar Aplicación';
        formApp.reset();
    }
});

// 🧩 Limpiar formulario al cerrar el modal
modalEl.addEventListener('hidden.bs.modal', () => {
    formApp.reset();
    modalTitle.textContent = 'Registrar Aplicación';
    editando = null;
});


// --- Validar sesión ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        Swal.fire({
            icon: 'warning',
            title: 'Sesión expirada',
            text: 'Por favor inicia sesión nuevamente.',
            confirmButtonColor: '#23223F'
        }).then(() => window.location.href = 'index.html');
    } else {
        await cargarTesters();
        await cargarApps();
    }
});
