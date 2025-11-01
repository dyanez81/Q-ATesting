// /js/bugs.js
import { db, storage, auth } from './firebase-config.js';
import {
    collection,
    getDocs,
    getDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    limit,
    startAfter,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import {
    ref,
    uploadBytes,
    getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';

// --- Referencias DOM ---
const tabla = document.querySelector('#tablaBugs tbody');
const form = document.getElementById('formBug');
const evidenciaInput = document.getElementById('evidenciaSolucion');
const preview = document.getElementById('previewEvidencia');
const btnVolver = document.getElementById('btnVolver');
const btnRecargar = document.getElementById('btnRecargarBugs');
let editandoId = null;

// --- Configuración de paginación ---
const PAGE_SIZE = 10;
let lastVisible = null;
let firstVisible = null;
let currentPage = 1;
let lastDocsStack = [];

const modalEl = document.getElementById('modalBug');
let modal = null;
function ensureModal() {
    if (!modal && modalEl && window.bootstrap?.Modal) {
        modal = new window.bootstrap.Modal(modalEl);
    }
}
// 🔄 Modal de carga
let loadingModal = null;
const loadingEl = document.getElementById('loadingModal');
function showLoading() {
    if (!loadingModal && window.bootstrap?.Modal) {
        loadingModal = new bootstrap.Modal(loadingEl);
    }
    loadingModal?.show();
}
function hideLoading() {
    loadingModal?.hide();
}


// --- 🔙 Botón Volver a Casos ---
btnVolver?.addEventListener('click', () => {
    const params = new URLSearchParams(window.location.search);
    const appId = params.get('app');
    const moduloId = params.get('modulo');
    const matrizId = params.get('id');

    if (appId && moduloId && matrizId) {
        window.location.href = `casos.html?app=${appId}&modulo=${moduloId}&id=${matrizId}`;
    } else {
        Swal.fire({
            icon: 'info',
            title: 'Redirigiendo...',
            text: 'Volviendo al listado principal.',
            timer: 1500,
            showConfirmButton: false
        }).then(() => {
            window.location.href = 'matrices.html';
        });
    }
});

// --- 🐞 Cargar Bugs (con paginación) ---
async function cargarBugs(pagina = 1, direction = 'next') {
    tabla.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">Cargando bugs...</td></tr>`;

    try {
        let q;
        const ref = collection(db, 'bugs');

        if (pagina === 1 && direction === 'next') {
            q = query(ref, orderBy('fechaReporte', 'desc'), limit(PAGE_SIZE));
            lastDocsStack = [];
        } else if (direction === 'next' && lastVisible) {
            q = query(ref, orderBy('fechaReporte', 'desc'), startAfter(lastVisible), limit(PAGE_SIZE));
        } else if (direction === 'prev' && lastDocsStack.length > 0) {
            const prevCursor = lastDocsStack.pop();
            q = query(ref, orderBy('fechaReporte', 'desc'), startAfter(prevCursor), limit(PAGE_SIZE));
            currentPage--;
        }

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            tabla.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No hay bugs registrados.</td></tr>`;
            return;
        }

        firstVisible = snapshot.docs[0];
        lastVisible = snapshot.docs[snapshot.docs.length - 1];
        if (direction === 'next') lastDocsStack.push(firstVisible);

        tabla.innerHTML = '';
        let i = (currentPage - 1) * PAGE_SIZE + 1;

        snapshot.forEach((docSnap) => {
            const bug = docSnap.data();
            const evidencia = bug.evidenciaUrl
                ? bug.evidenciaUrl.toLowerCase().endsWith('.pdf')
                    ? `<a href="${bug.evidenciaUrl}" target="_blank"><i class="bi bi-file-earmark-pdf text-danger fs-5"></i></a>`
                    : `<img src="${bug.evidenciaUrl}" alt="Evidencia" style="max-width:50px; border-radius:4px;">`
                : '-';

            const fecha = bug.fechaReporte
                ? new Date(bug.fechaReporte.toDate()).toLocaleDateString('es-MX')
                : '-';

            const tr = `
        <tr>
          <td>${i++}</td>
          <td>${bug.nombre || '-'}</td>
          <td>${bug.descripcion || '-'}</td>
          <td><span class="badge ${getBadgeClass(bug.estado)}">${bug.estado}</span></td>
          <td>${bug.tester || '-'}</td>
          <td>${bug.datos?.casoNombre || '-'}</td>
          <td>${fecha}</td>
          <td class="text-center">${evidencia}</td>
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
    } catch (error) {
        console.error('❌ Error al cargar bugs:', error);
        Swal.fire('Error', 'No se pudieron cargar los bugs.', 'error');
    }
}

// --- 🧩 Clase visual del estado ---
function getBadgeClass(estado) {
    switch (estado) {
        case 'Corregido':
            return 'bg-warning text-dark';
        case 'Validado':
            return 'bg-success';
        default:
            return 'bg-danger';
    }
}

// --- ✏️ Editar / Eliminar ---
tabla?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'editar') {
        try {
            
            const refBug = doc(db, 'bugs', id);
            const snap = await getDoc(refBug);
            if (!snap.exists()) {
                Swal.fire('Error', 'No se encontró el bug en Firestore.', 'error');
                return;
            }

            const bug = snap.data();
            editandoId = id;

            document.getElementById('nombreBug').value = bug.nombre || '';
            document.getElementById('testerBug').value = bug.tester || '';
            document.getElementById('descripcionBug').value = bug.descripcion || '';
            document.getElementById('estadoBug').value = bug.estado || 'Abierto';
            document.getElementById('comentarioSolucion').value = bug.solucion?.comentarios || '';

            preview.innerHTML = '';
            if (bug.solucion?.evidencia) renderPreview(bug.solucion.evidencia);

            ensureModal();
            modal.show();

        } catch (err) {
            console.error('❌ Error al cargar bug:', err);
            Swal.fire('Error', 'No se pudo cargar el bug para editar.', 'error');
        }
    }

    if (action === 'eliminar') {
        const confirm = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar bug?',
            text: 'Esta acción no se puede deshacer.',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
        });

        if (!confirm.isConfirmed) return;

        try {
            await deleteDoc(doc(db, 'bugs', id));
            Swal.fire('Eliminado', 'Bug eliminado correctamente.', 'success');
            cargarBugs(currentPage);
        } catch (err) {
            console.error('❌ Error al eliminar bug:', err);
            Swal.fire('Error', 'No se pudo eliminar el bug.', 'error');
        }
    }
});

// --- 💾 Guardar solución ---
form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!editandoId) return;

    try {
        const evidenciaFile = evidenciaInput.files[0];
        let evidenciaUrl = null;

        if (evidenciaFile) {
            const refEvid = ref(storage, `bugs_evidencias/${Date.now()}_${evidenciaFile.name}`);
            await uploadBytes(refEvid, evidenciaFile);
            evidenciaUrl = await getDownloadURL(refEvid);
        }

        const solucion = {
            tester: auth.currentUser?.email || 'tester@finsus.mx',
            comentarios: document.getElementById('comentarioSolucion').value.trim(),
            evidencia: evidenciaUrl || null,
            fechaUpdate: serverTimestamp(),
        };

        await updateDoc(doc(db, 'bugs', editandoId), {
            estado: document.getElementById('estadoBug').value,
            solucion,
            updatedAt: serverTimestamp(),
        });
        Swal.fire('Actualizado', 'Bug actualizado correctamente.', 'success');
        ensureModal();
        modal.hide();
        form.reset();
        cargarBugs(currentPage);
    } catch (err) {
        console.error('❌ Error al guardar bug:', err);
        Swal.fire('Error', 'No se pudo guardar la actualización.', 'error');
    }
});

// --- 🔍 Mostrar evidencia ---
function renderPreview(url) {
    if (!url) return;
    const html = url.toLowerCase().endsWith('.pdf')
        ? `<a href="${url}" target="_blank"><i class="bi bi-file-earmark-pdf text-danger"></i> Ver PDF</a>`
        : `<img src="${url}" alt="Evidencia" style="max-width:100px; border-radius:6px;">`;
    preview.innerHTML = html;
}

// --- Reset modal ---
modalEl?.addEventListener('hidden.bs.modal', () => {
    form?.reset();
    preview.innerHTML = '';
    editandoId = null;
});

// --- Paginación ---
document.getElementById('nextPage')?.addEventListener('click', async () => {
    currentPage++;
    await cargarBugs(currentPage, 'next');
});

document.getElementById('prevPage')?.addEventListener('click', async () => {
    if (currentPage > 1) {
        currentPage--;
        await cargarBugs(currentPage, 'prev');
    }
});

// --- Recargar manual ---
btnRecargar?.addEventListener('click', () => cargarBugs(1));

// --- Inicialización ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        Swal.fire({
            icon: 'warning',
            title: 'Sesión expirada',
            text: 'Por favor, inicia sesión nuevamente.',
            confirmButtonColor: '#23223F',
        }).then(() => (window.location.href = 'index.html'));
    } else {
        cargarBugs(1);
    }
});
