// /js/apps.js
import { db, auth } from './firebase-config.js';
import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    getDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';

const form = document.getElementById('formApp');
const tabla = document.querySelector('#tablaApps tbody');
const modalEl = document.getElementById('modalApp');
const modal = new bootstrap.Modal(modalEl);
const testerSelect = document.getElementById('testerApp');
let editandoId = null;

// --- 🔹 Cargar testers ---
async function cargarTesters() {
    testerSelect.innerHTML = '<option value="">Seleccionar Tester</option>';

    try {
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (
                data.role?.toLowerCase() === 'tester' ||
                data.isTester === true ||
                data.role === 'QA'
            ) {
                const opt = document.createElement('option');
                opt.value = data.email || docSnap.id;
                opt.textContent = data.name || data.email || '(Sin nombre)';
                opt.dataset.uid = docSnap.id;
                testerSelect.appendChild(opt);
            }
        });

        if (testerSelect.options.length === 1) {
            const opt = document.createElement('option');
            opt.disabled = true;
            opt.textContent = '⚠️ No hay testers registrados';
            testerSelect.appendChild(opt);
        }
    } catch (err) {
        console.error('❌ Error cargando testers:', err);
    }
}

// --- 🔹 Cargar Apps en tiempo real ---
function cargarApps() {
    tabla.innerHTML = `
    <tr><td colspan="7" class="text-center text-muted py-3">Cargando...</td></tr>
  `;

    onSnapshot(collection(db, 'apps'), (snapshot) => {
        tabla.innerHTML = '';

        if (snapshot.empty) {
            tabla.innerHTML = `
        <tr><td colspan="7" class="text-center text-muted py-3">No hay aplicaciones registradas</td></tr>
      `;
            return;
        }

        let i = 1;
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td>${i++}</td>
        <td>${data.nombre || '-'}</td>
        <td>${data.tipo || '-'}</td>
        <td>${data.testerNombre || data.tester || '-'}</td>
        <td>${data.requerimiento || '-'}</td>
        <td>${data.fechaFin ? new Date(data.fechaFin.toDate()).toLocaleDateString() : '-'}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-primary me-2" data-id="${docSnap.id}" data-action="editar">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" data-id="${docSnap.id}" data-action="eliminar">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      `;
            tabla.appendChild(tr);
        });
    });
}

// --- 🔹 Guardar / editar App ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const sel = testerSelect.selectedOptions[0];
    const testerEmail = sel?.value || '';
    const testerNombre = sel?.textContent || '';
    const testerUid = sel?.dataset.uid || '';

    const nuevaApp = {
        nombre: document.getElementById('nombreApp').value.trim(),
        tipo: document.getElementById('tipoApp').value.trim(),
        tester: testerEmail,
        testerNombre,
        testerUid,
        requerimiento: document.getElementById('requerimientoApp').value.trim(),
        fechaFin: document.getElementById('fechaFinApp').value
            ? new Date(document.getElementById('fechaFinApp').value)
            : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    try {
        if (editandoId) {
            await updateDoc(doc(db, 'apps', editandoId), nuevaApp);
            Swal.fire('Actualizado', 'Aplicación modificada correctamente.', 'success');
        } else {
            await addDoc(collection(db, 'apps'), nuevaApp);
            Swal.fire('Registrado', 'Aplicación creada correctamente.', 'success');
        }

        form.reset();
        editandoId = null;
        modal.hide();
    } catch (error) {
        console.error('❌ Error guardando app:', error);
        Swal.fire('Error', 'No se pudo guardar la aplicación.', 'error');
    }
});

// --- 🔹 Editar / Eliminar ---
tabla.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'editar') {
        try {
            const ref = doc(db, 'apps', id);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const data = snap.data();
                document.getElementById('nombreApp').value = data.nombre || '';
                document.getElementById('tipoApp').value = data.tipo || '';
                await cargarTesters(); // asegurar que el combo esté actualizado
                testerSelect.value = data.tester || '';
                document.getElementById('requerimientoApp').value = data.requerimiento || '';
                document.getElementById('fechaFinApp').value = data.fechaFin
                    ? new Date(data.fechaFin.toDate()).toISOString().split('T')[0]
                    : '';
                editandoId = id;
                modal.show();
            }
        } catch (error) {
            console.error('❌ Error al editar app:', error);
        }
    }

    if (action === 'eliminar') {
        const conf = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar aplicación?',
            text: 'Esta acción no se puede deshacer.',
            showCancelButton: true,
            confirmButtonText: 'Eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#d33'
        });

        if (conf.isConfirmed) {
            await deleteDoc(doc(db, 'apps', id));
            Swal.fire('Eliminada', 'Aplicación borrada correctamente.', 'success');
        }
    }
});

// --- 🔹 Refrescar testers cada vez que se abre el modal ---
modalEl.addEventListener('show.bs.modal', async () => {
    await cargarTesters();
});

// --- 🔹 Inicializar ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        Swal.fire({
            icon: 'warning',
            title: 'Sesión expirada',
            text: 'Por favor, inicia sesión nuevamente.',
            confirmButtonColor: '#23223F'
        }).then(() => (window.location.href = 'index.html'));
    } else {
        cargarApps();
        cargarTesters();
    }
});
