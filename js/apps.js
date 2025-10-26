// /js/apps.js
import { db, auth } from './firebase-config.js';
import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    query,
    orderBy,
    limit,
    startAfter,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';

// --- Elementos del DOM ---
const form = document.getElementById('formApp');
const tabla = document.querySelector('#tablaApps tbody');
const modalEl = document.getElementById('modalApp');
const modal = new bootstrap.Modal(modalEl);
const testerSelect = document.getElementById('testerApp');
const btnRecargar = document.getElementById('btnRecargarApps');

let editandoId = null;

// --- Configuración de paginación ---
const PAGE_SIZE = 10;
let lastVisible = null;
let firstVisible = null;
let currentPage = 1;
let lastDocsStack = [];

// --- 🔹 Cargar testers ---
async function cargarTesters() {
    testerSelect.innerHTML = '<option value="">QA Finsus</option>';

    try {
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);

        snapshot.forEach((docSnap) => {
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

// --- 🔹 Cargar Apps con paginación ---
async function cargarApps(pagina = 1, direction = 'next') {
    tabla.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">Cargando aplicaciones...</td></tr>`;

    try {
        let q;
        const ref = collection(db, 'apps');

        // Primera carga
        if (pagina === 1 && direction === 'next') {
            q = query(ref, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
            lastDocsStack = [];
        }
        // Página siguiente
        else if (direction === 'next' && lastVisible) {
            q = query(ref, orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(PAGE_SIZE));
        }
        // Página anterior
        else if (direction === 'prev' && lastDocsStack.length > 0) {
            const prevCursor = lastDocsStack.pop();
            q = query(ref, orderBy('createdAt', 'desc'), startAfter(prevCursor), limit(PAGE_SIZE));
            currentPage--;
        }

        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            tabla.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No hay aplicaciones registradas.</td></tr>`;
            return;
        }

        // Actualiza cursores
        firstVisible = snapshot.docs[0];
        lastVisible = snapshot.docs[snapshot.docs.length - 1];
        if (direction === 'next' && snapshot.docs.length > 0) {
            lastDocsStack.push(firstVisible);
        }

        // Renderizar tabla
        tabla.innerHTML = '';
        let i = (currentPage - 1) * PAGE_SIZE + 1;

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const fecha = data.fechaFin
                ? new Date(data.fechaFin.toDate()).toLocaleDateString('es-MX')
                : '-';
            const tr = `
        <tr>
          <td>${i++}</td>
          <td>${data.nombre || '-'}</td>
          <td>${data.tipo || '-'}</td>
          <td>${data.testerNombre || data.tester || 'QA Finsus'}</td>
          <td>${data.requerimiento || '-'}</td>
          <td>${fecha}</td>
          <td class="text-center">
            <button class="btn btn-sm btn-outline-primary me-2" data-id="${docSnap.id}" data-action="editar" title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" data-id="${docSnap.id}" data-action="eliminar" title="Eliminar">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `;
            tabla.insertAdjacentHTML('beforeend', tr);
        });

        document.getElementById('paginaActual').textContent = `Página ${currentPage}`;
    } catch (err) {
        console.error('❌ Error al cargar apps:', err);
        Swal.fire('Error', 'No se pudieron cargar las aplicaciones.', 'error');
    }
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
        updatedAt: serverTimestamp(),
    };

    try {
        if (editandoId) {
            await updateDoc(doc(db, 'apps', editandoId), nuevaApp);
            Swal.fire('Actualizado', 'Aplicación modificada correctamente.', 'success');
        } else {
            await addDoc(collection(db, 'apps'), {
                ...nuevaApp,
                estatus: true,
                createdAt: serverTimestamp(),
            });
            Swal.fire('Registrado', 'Aplicación creada correctamente.', 'success');
        }

        form.reset();
        editandoId = null;
        modal.hide();
        await cargarApps(currentPage);
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
                await cargarTesters();
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
            Swal.fire('Error', 'No se pudo cargar la aplicación.', 'error');
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
            await cargarApps(currentPage);
        }
    }
});

// --- 🔹 Refrescar testers al abrir modal ---
modalEl.addEventListener('show.bs.modal', async () => {
    await cargarTesters();
});

// --- 🔹 Botones de paginación ---
document.getElementById('nextPage')?.addEventListener('click', async () => {
    currentPage++;
    await cargarApps(currentPage, 'next');
});

document.getElementById('prevPage')?.addEventListener('click', async () => {
    if (currentPage > 1) {
        currentPage--;
        await cargarApps(currentPage, 'prev');
    }
});

// --- 🔹 Botón de recarga manual ---
btnRecargar?.addEventListener('click', () => cargarApps(1));

// --- 🔹 Inicializar sesión y carga ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        Swal.fire({
            icon: 'warning',
            title: 'Sesión expirada',
            text: 'Por favor, inicia sesión nuevamente.',
            confirmButtonColor: '#23223F'
        }).then(() => (window.location.href = 'index.html'));
    } else {
        await cargarTesters();
        await cargarApps(1);
    }
});
