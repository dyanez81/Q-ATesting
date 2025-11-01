import { db, auth } from './firebase-config.js';
import {
    collection, addDoc, getDocs, updateDoc, deleteDoc, doc, getDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';

const tabla = document.querySelector('#tablaRequerimientos tbody');
const form = document.getElementById('formRequerimiento');
const testerSelect = document.getElementById('tester');
const modal = new bootstrap.Modal(document.getElementById('modalRequerimiento'));

const appId = new URLSearchParams(window.location.search).get('appId');
let editandoId = null;

// ==============================
// ✅ Validar appId
// ==============================
if (!appId) {
  // Intentar recuperar desde almacenamiento local
  appId = localStorage.getItem('appId');
}

if (!appId) {
  Swal.fire({
    icon: 'error',
    title: 'Error de ruta',
    text: 'No se proporcionó el identificador de la aplicación.',
  }).then(() => (window.location.href = 'apps.html'));
  // 👇 No lanzar throw: permite que Firebase Auth termine de inicializar
  console.warn('⚠️ appId no definido al inicio, esperando Auth...');
}

// ==============================
// CARGAR APP Y TESTERS
// ==============================
async function cargarAppYTesters() {
    const appSnap = await getDoc(doc(db, 'apps', appId));
    if (appSnap.exists())
        document.getElementById('tituloApp').textContent = `Requerimientos - ${appSnap.data().nombre}`;

    testerSelect.innerHTML = '<option value="">Seleccionar tester...</option>';
    const usersSnap = await getDocs(collection(db, 'users'));

    usersSnap.forEach((u) => {
        const data = u.data();
        if (['tester', 'qa'].includes(data.role?.toLowerCase())) {
            const opt = document.createElement('option');
            opt.value = u.id;
            opt.textContent = data.name || data.email;
            testerSelect.appendChild(opt);
        }
    });
}

// ==============================
// CARGAR REQUERIMIENTOS
// ==============================
async function cargarRequerimientos() {
    tabla.innerHTML = `<tr><td colspan="9" class="text-center">Cargando...</td></tr>`;

    const ref = collection(db, `apps/${appId}/requerimientos`);
    const snap = await getDocs(ref);
    tabla.innerHTML = '';

    let i = 1;
    for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const tipoBadge = data.miniMatriz
            ? `<span class="badge bg-info text-dark px-3 py-2 shadow-sm">Mini Matriz</span>`
            : `<span class="badge bg-success px-3 py-2 shadow-sm">Tareas</span>`;

        tabla.insertAdjacentHTML('beforeend', `
      <tr>
        <td>${i++}</td>
        <td>${data.folio || '-'}</td>
        <td>${data.descripcion || '-'}</td>
        <td>${data.testerNombre || '-'}</td>
        <td>${data.estado || '-'}</td>
        <td>${data.fechaInicio ? new Date(data.fechaInicio.toDate()).toLocaleDateString() : '-'}</td>
        <td>${data.fechaFin ? new Date(data.fechaFin.toDate()).toLocaleDateString() : '-'}</td>
        <td>${tipoBadge}</td>
        <td class="text-nowrap">
          <button class="btn btn-sm btn-outline-primary me-2" data-action="editar" data-id="${docSnap.id}">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger me-2" data-action="eliminar" data-id="${docSnap.id}">
            <i class="bi bi-trash"></i>
          </button>
          ${data.miniMatriz
                ? `<button class="btn btn-sm btn-outline-info" data-action="miniMatriz" data-id="${docSnap.id}">
                   <i class="bi bi-grid"></i>
                 </button>`
                : `<button class="btn btn-sm btn-outline-success" data-action="tareas" data-id="${docSnap.id}">
                   <i class="bi bi-list-check"></i>
                 </button>`
            }
        </td>
      </tr>
    `);
    }
}

// ==============================
// GUARDAR / ACTUALIZAR
// ==============================
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const sel = testerSelect.selectedOptions[0];
    const data = {
        folio: form.folio.value.trim(),
        descripcion: form.descripcion.value.trim(),
        estado: form.estado.value,
        testerUid: sel?.value || '',
        testerNombre: sel?.textContent || '',
        miniMatriz: document.getElementById('miniMatrizCheck').checked,
        fechaInicio: form.fechaInicio.value ? new Date(form.fechaInicio.value) : serverTimestamp(),
        fechaFin: form.fechaFin.value ? new Date(form.fechaFin.value) : null,
        updatedAt: serverTimestamp(),
    };

    try {
        const ref = collection(db, `apps/${appId}/requerimientos`);
        if (editandoId) {
            await updateDoc(doc(ref, editandoId), data);
            Swal.fire('✅ Actualizado', 'Requerimiento modificado correctamente', 'success');
        } else {
            await addDoc(ref, { ...data, createdAt: serverTimestamp() });
            Swal.fire('✅ Guardado', 'Requerimiento creado correctamente', 'success');
        }

        form.reset();
        document.getElementById('miniMatrizCheck').checked = false;
        editandoId = null;
        modal.hide();
        cargarRequerimientos();
    } catch (error) {
        console.error('❌ Error al guardar:', error);
        Swal.fire('Error', 'No se pudo guardar el requerimiento', 'error');
    }
});

// ==============================
// ACCIONES EN TABLA
// ==============================
tabla.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const ref = doc(db, `apps/${appId}/requerimientos/${id}`);

    switch (action) {
        case 'editar':
            const snap = await getDoc(ref);
            if (!snap.exists()) return;
            const data = snap.data();

            editandoId = id;
            form.folio.value = data.folio || '';
            form.descripcion.value = data.descripcion || '';
            form.estado.value = data.estado || 'Pendiente';
            testerSelect.value = data.testerUid || '';
            document.getElementById('miniMatrizCheck').checked = !!data.miniMatriz;
            if (data.fechaInicio) form.fechaInicio.value = new Date(data.fechaInicio.toDate()).toISOString().split('T')[0];
            if (data.fechaFin) form.fechaFin.value = new Date(data.fechaFin.toDate()).toISOString().split('T')[0];

            modal.show();
            break;

        case 'eliminar':
            Swal.fire({
                icon: 'warning',
                title: '¿Eliminar requerimiento?',
                showCancelButton: true,
                confirmButtonText: 'Eliminar',
                cancelButtonText: 'Cancelar',
            }).then(async (r) => {
                if (r.isConfirmed) {
                    await deleteDoc(ref);
                    Swal.fire('🗑️ Eliminado', 'Requerimiento eliminado correctamente', 'success');
                    cargarRequerimientos();
                }
            });
            break;

        case 'tareas':
            console.log("📦 appId:", appId, "reqId:", id);
            window.location.href = `tarea-req.html?appId=${appId}&reqId=${id}`;
            break;

        case 'miniMatriz':
            window.location.href = `mini-matriz.html?appId=${appId}&reqId=${id}`;
            break;
    }
});

// ==============================
document.getElementById('btnVolver').addEventListener('click', () => {
    window.location.href = 'apps.html';
});

// ==============================
let sesionVerificada = false;

onAuthStateChanged(auth, async (user) => {
    if (sesionVerificada) return; // ⛔ Evita ejecutar de nuevo tras navegar

    if (!user) {
        // Esperar un poco antes de asumir cierre de sesión
        setTimeout(() => {
            if (!auth.currentUser) {
                Swal.fire('Sesión expirada', 'Inicia sesión nuevamente', 'warning')
                    .then(() => (window.location.href = 'index.html'));
            }
        }, 1500);
    } else {
        sesionVerificada = true; // ✅ Bloquea futuras ejecuciones
        await cargarAppYTesters();
        await cargarRequerimientos();
    }
});
localStorage.setItem('appId', appId);

