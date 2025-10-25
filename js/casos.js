// /js/casos.js
import { db, storage, auth } from './firebase-config.js';
import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import {
    ref,
    uploadBytes,
    getDownloadURL,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';

// --- Parámetros de URL ---
const params = new URLSearchParams(window.location.search);
const appId = params.get('app');
const moduloId = params.get('modulo');
const matrizId = params.get('id');

if (!appId || !moduloId || !matrizId) {
    Swal.fire('Error', 'No se ha especificado correctamente la matriz.', 'error')
        .then(() => (window.location.href = 'matrices.html'));
    throw new Error('Faltan parámetros en la URL');
}

// --- DOM Elements ---
const tabla = document.querySelector('#tablaCasos tbody');
const form = document.getElementById('formCaso');
const modalEl = document.getElementById('modalCaso');
const modal = modalEl ? new bootstrap.Modal(modalEl) : null;
const evidenciaInput = document.getElementById('evidenciaCaso');
const matrizTitleEl = document.getElementById('nombreMatriz');
const backBtn = document.getElementById('btnVolver');

let editandoId = null;

// --- Ruta base ---
const casosPathBase = `apps/${appId}/modulos/${moduloId}/matrices/${matrizId}/casos`;

// --- Pintar título de matriz ---
async function pintarTituloMatriz() {
    try {
        const matrizRef = doc(db, `apps/${appId}/modulos/${moduloId}/matrices/${matrizId}`);
        const snap = await getDoc(matrizRef);
        if (snap.exists()) {
            const data = snap.data();
            matrizTitleEl.textContent = data.nombre || data.NombreDelCaso || 'Matriz';
        }
    } catch (e) {
        console.error('Error obteniendo título de la matriz:', e);
    }
}

// --- Botón Volver ---
backBtn?.addEventListener('click', () => {
    window.location.href = 'matrices.html';
});

// --- Cargar Casos ---
async function cargarCasos() {
    tabla.innerHTML = `
        <tr><td colspan="6" class="text-center text-muted py-4">Cargando casos...</td></tr>
    `;
    try {
        const casosSnap = await getDocs(collection(db, casosPathBase));
        if (casosSnap.empty) {
            tabla.innerHTML = `
                <tr><td colspan="6" class="text-center text-muted py-4">No hay casos registrados.</td></tr>
            `;
            return;
        }

        let html = '';
        let i = 1;
        casosSnap.forEach((docSnap) => {
            const data = docSnap.data();
            html += `
            <tr>
                <td>${i++}</td>
                <td>${data.NombreDelCaso || '-'}</td>
                <td>${data.TipoDePrueba || '-'}</td>
                <td>${data.Estado || '-'}</td>
                <td>${data.Tester || '-'}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary me-2" data-id="${docSnap.id}" data-action="editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" data-id="${docSnap.id}" data-action="eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>`;
        });

        tabla.innerHTML = html;
    } catch (err) {
        console.error('Error al cargar casos:', err);
        Swal.fire('Error', 'No se pudieron cargar los casos.', 'error');
    }
}

// --- Guardar / Actualizar Caso ---
form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentUser = auth.currentUser?.email || 'desconocido@finsus.mx';
    const caso = {
        NombreDelCaso: document.getElementById('nombreCaso').value.trim(),
        Descripcion: document.getElementById('descripcionCaso').value.trim(),
        Precondiciones: document.getElementById('precondicionesCaso').value.trim(),
        Pasos: document.getElementById('pasosCaso').value.trim(),
        TipoDePrueba: document.getElementById('tipoPruebaCaso').value.trim(),
        ResultadoEsperado: document.getElementById('resultadoEsperadoCaso').value.trim(),
        Estado: document.getElementById('estadoCaso').value,
        Comentarios: document.getElementById('comentariosCaso').value.trim(),
        Tester: 'tester@finsus.mx',
        ReferenciaHU: document.getElementById('referenciaCaso').value.trim(),
        FechaEjecucion: serverTimestamp(),
        Fecha: serverTimestamp(),
        updatedAt: serverTimestamp(),
        UltimaActualizacionPor: currentUser
    };

    try {
        if (evidenciaInput?.files?.length > 0) {
            const file = evidenciaInput.files[0];
            const fileRef = ref(storage, `evidencias/${Date.now()}_${file.name}`);
            await uploadBytes(fileRef, file);
            caso.EvidenciaNombre = file.name;
            caso.EvidenciaUrl = await getDownloadURL(fileRef);
        }

        if (editandoId) {
            const refCaso = doc(db, `${casosPathBase}/${editandoId}`);
            await updateDoc(refCaso, caso);
            Swal.fire('Actualizado', 'El caso fue actualizado correctamente.', 'success');
        } else {
            caso.createdAt = serverTimestamp();
            caso.CreadoPor = currentUser;
            await addDoc(collection(db, casosPathBase), caso);
            Swal.fire('Registrado', 'El caso fue registrado correctamente.', 'success');
        }

        form.reset();
        limpiarPreview();
        editandoId = null;
        modal?.hide();
        cargarCasos();
    } catch (err) {
        console.error('Error al guardar caso:', err);
        Swal.fire('Error', 'No se pudo guardar el caso.', 'error');
    }
});

// --- Delegación de botones (Editar / Eliminar) ---
tabla?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'editar') {
        try {
            const refCaso = doc(db, `${casosPathBase}/${id}`);
            const snap = await getDoc(refCaso);
            if (!snap.exists()) {
                Swal.fire('Error', 'No se encontró el caso en Firestore.', 'error');
                return;
            }

            const data = snap.data();
            editandoId = id;

            document.getElementById('nombreCaso').value = data.NombreDelCaso || '';
            document.getElementById('tipoPruebaCaso').value = data.TipoDePrueba || '';
            document.getElementById('descripcionCaso').value = data.Descripcion || '';
            document.getElementById('precondicionesCaso').value = data.Precondiciones || '';
            document.getElementById('pasosCaso').value = data.Pasos || '';
            document.getElementById('resultadoEsperadoCaso').value = data.ResultadoEsperado || '';
            document.getElementById('estadoCaso').value = data.Estado || 'Pendiente';
            document.getElementById('comentariosCaso').value = data.Comentarios || '';
            document.getElementById('referenciaCaso').value = data.ReferenciaHU || '';
            renderPreview(data.EvidenciaUrl);

            modal?.show();
        } catch (err) {
            console.error('❌ Error al cargar caso para edición:', err);
            Swal.fire('Error', 'No se pudo cargar el caso para editar.', 'error');
        }
    }

    if (action === 'eliminar') {
        const confirm = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar caso?',
            text: 'Esta acción no se puede deshacer.',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
        });

        if (!confirm.isConfirmed) return;

        try {
            await deleteDoc(doc(db, `${casosPathBase}/${id}`));
            Swal.fire('Eliminado', 'El caso fue eliminado correctamente.', 'success');
            cargarCasos();
        } catch (err) {
            console.error('❌ Error al eliminar caso:', err);
            Swal.fire('Error', 'No se pudo eliminar el caso.', 'error');
        }
    }
});

// --- Preview Evidencia ---
function renderPreview(url) {
    limpiarPreview();
    if (!url) return;
    const holder = evidenciaInput?.parentNode;
    if (!holder) return;

    const cont = document.createElement('div');
    cont.className = 'mt-2';
    cont.innerHTML = url.toLowerCase().endsWith('.pdf')
        ? `<small class="text-muted">Evidencia actual:</small><br>
           <a href="${url}" target="_blank" class="text-decoration-none">
             <i class="bi bi-file-earmark-pdf text-danger"></i> Ver PDF
           </a>`
        : `<small class="text-muted">Evidencia actual:</small><br>
           <img src="${url}" alt="Evidencia" style="max-width:120px; border-radius:6px;">`;
    holder.appendChild(cont);
    holder.lastChild.id = 'preview-evidencia';
}

function limpiarPreview() {
    const prev = document.getElementById('preview-evidencia');
    if (prev) prev.remove();
}

// --- Reset al cerrar modal ---
modalEl?.addEventListener('hidden.bs.modal', () => {
    form.reset();
    limpiarPreview();
    editandoId = null;
});

// --- Iniciar sesión y carga ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        Swal.fire({
            icon: 'warning',
            title: 'Sesión expirada',
            text: 'Por favor, inicia sesión nuevamente.',
            confirmButtonColor: '#23223F'
        }).then(() => (window.location.href = 'index.html'));
    } else {
        pintarTituloMatriz();
        cargarCasos();
    }
});
