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
    query,
    where,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

import {
    ref,
    uploadBytes,
    getDownloadURL,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';

// --- Parámetros URL ---
const params = new URLSearchParams(window.location.search);
const appId = params.get('app');
const moduloId = params.get('modulo');
const matrizId = params.get('id');

console.log('🧩 Parámetros URL:', { appId, moduloId, matrizId });

if (!appId || !moduloId || !matrizId) {
    Swal.fire('Error', 'No se ha especificado correctamente la matriz.', 'error')
        .then(() => (window.location.href = 'matrices.html'));
    throw new Error('Faltan parámetros en la URL');
}

// --- Referencias DOM ---
const tabla = document.querySelector('#tablaCasos tbody');
const form = document.getElementById('formCaso');
const modalEl = document.getElementById('modalCaso');
const modal = modalEl ? new bootstrap.Modal(modalEl) : null;
const evidenciaInput = document.getElementById('evidenciaCaso');
const matrizTitleEl = document.getElementById('nombreMatriz');
const backBtn = document.getElementById('btnVolver');

// --- Modal y formulario de bug ---
const modalBugEl = document.getElementById('modalBug');
const modalBug = modalBugEl ? new bootstrap.Modal(modalBugEl) : null;
const formBug = document.getElementById('formBug');
const bugCasoNombre = document.getElementById('bugCasoNombre');
const bugNombre = document.getElementById('bugNombre');
const bugDescripcion = document.getElementById('bugDescripcion');
const bugEvidencia = document.getElementById('bugEvidencia');

// --- Variables globales ---
let editandoId = null;
let casoActual = null;

// --- Ruta base ---
const casosPathBase = `apps/${appId}/modulos/${moduloId}/matrices/${matrizId}/casos`;

// --- Pintar título de la matriz ---
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

// --- Cargar casos ---
async function cargarCasos() {
    if (!tabla) return;
    tabla.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Cargando casos...</td></tr>`;

    try {
        // 1️⃣ Obtener todos los casos
        const casosSnap = await getDocs(collection(db, casosPathBase));
        if (casosSnap.empty) {
            tabla.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No hay casos registrados.</td></tr>`;
            return;
        }

        // 2️⃣ Obtener todos los bugs de la matriz actual
        const bugsQuery = query(
            collection(db, 'bugs'),
            where('datos.matrizId', '==', matrizId)
        );
        const bugsSnap = await getDocs(bugsQuery);

        // Mapeamos casos con bugs existentes
        const casosConBugs = new Set();
        bugsSnap.forEach((bug) => {
            const bugData = bug.data();
            if (bugData.datos?.casoId) casosConBugs.add(bugData.datos.casoId);
        });

        // 3️⃣ Renderizar tabla
        let html = '';
        let i = 1;
        casosSnap.forEach((docSnap) => {
            const data = docSnap.data();
            const tieneBug = casosConBugs.has(docSnap.id);

            // 🐞 Icono visual si el caso tiene bugs
            const iconoBug = tieneBug
                ? `<i class="bi bi-bug-fill text-danger ms-1" title="Este caso tiene reportes de bugs"></i>`
                : '';

            // 🎨 Badge de color según estado
            let estadoClass = 'secondary';
            if (data.Estado === 'Positivo') estadoClass = 'success';
            else if (data.Estado === 'Pendiente') estadoClass = 'warning';
            else if (data.Estado === 'Fallo') estadoClass = 'danger';
            else if (data.Estado === 'Bloqueado') estadoClass = 'secondary';

            html += `
        <tr>
          <td>${i++}</td>
          <td>${data.NombreDelCaso || '-'} ${iconoBug}</td>
          <td>${data.TipoDePrueba || '-'}</td>
          <td><span class="badge bg-${estadoClass}">${data.Estado || '-'}</span></td>
          <td>${data.Tester || '-'}</td>
          <td class="text-center">
            <button class="btn btn-sm btn-outline-primary me-2" data-id="${docSnap.id}" data-action="editar" title="Editar caso">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger me-2" data-id="${docSnap.id}" data-action="eliminar" title="Eliminar caso">
              <i class="bi bi-trash"></i>
            </button>
            <button class="btn btn-sm btn-outline-warning" data-id="${docSnap.id}" data-action="bug" title="Reportar bug">
              <i class="bi bi-bug"></i>
            </button>
          </td>
        </tr>`;
        });

        tabla.innerHTML = html;
    } catch (error) {
        console.error('Error al cargar casos:', error);
        Swal.fire('Error', 'No se pudieron cargar los casos.', 'error');
    }
}


// --- Guardar / Actualizar caso ---
form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const caso = {
        NombreDelCaso: document.getElementById('nombreCaso').value.trim(),
        Descripcion: document.getElementById('descripcionCaso').value.trim(),
        Precondiciones: document.getElementById('precondicionesCaso').value.trim(),
        Pasos: document.getElementById('pasosCaso').value.trim(),
        TipoDePrueba: document.getElementById('tipoPruebaCaso').value.trim(),
        ResultadoEsperado: document.getElementById('resultadoEsperadoCaso').value.trim(),
        Estado: document.getElementById('estadoCaso').value,
        Tester: auth.currentUser?.email || 'tester@finsus.mx',
        Fecha: serverTimestamp(),
        FechaEjecucion: serverTimestamp(),
        updatedAt: serverTimestamp(),
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
            await addDoc(collection(db, casosPathBase), caso);
            Swal.fire('Registrado', 'El caso fue registrado correctamente.', 'success');
        }

        form.reset();
        editandoId = null;
        modal?.hide();
        cargarCasos();
    } catch (err) {
        console.error('Error al guardar caso:', err);
        Swal.fire('Error', 'No se pudo guardar el caso.', 'error');
    }
});

// --- Delegación de eventos: Editar / Eliminar / Reportar Bug ---
tabla?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'editar') {
        const refCaso = doc(db, `${casosPathBase}/${id}`);
        const snap = await getDoc(refCaso);
        if (!snap.exists()) return Swal.fire('Error', 'Caso no encontrado.', 'error');
        const data = snap.data();

        editandoId = id;
        document.getElementById('nombreCaso').value = data.NombreDelCaso || '';
        document.getElementById('tipoPruebaCaso').value = data.TipoDePrueba || '';
        document.getElementById('descripcionCaso').value = data.Descripcion || '';
        document.getElementById('precondicionesCaso').value = data.Precondiciones || '';
        document.getElementById('pasosCaso').value = data.Pasos || '';
        document.getElementById('resultadoEsperadoCaso').value = data.ResultadoEsperado || '';
        document.getElementById('estadoCaso').value = data.Estado || 'Pendiente';
        modal?.show();
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
        await deleteDoc(doc(db, `${casosPathBase}/${id}`));
        Swal.fire('Eliminado', 'El caso fue eliminado correctamente.', 'success');
        cargarCasos();
    }

    if (action === 'bug') {
        casoActual = id;
        const refCaso = doc(db, `${casosPathBase}/${id}`);
        const snap = await getDoc(refCaso);
        if (!snap.exists()) return;
        const data = snap.data();

        bugCasoNombre.value = data.NombreDelCaso || 'Caso sin nombre';
        bugNombre.value = '';
        bugDescripcion.value = '';
        bugEvidencia.value = '';
        modalBug?.show();
    }
});

// --- Guardar Bug ---
formBug?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        let evidenciaUrl = '';
        if (bugEvidencia?.files?.length > 0) {
            const file = bugEvidencia.files[0];
            const fileRef = ref(storage, `bugs/${Date.now()}_${file.name}`);
            await uploadBytes(fileRef, file);
            evidenciaUrl = await getDownloadURL(fileRef);
        }

        const bug = {
            nombre: bugNombre.value.trim(),
            descripcion: bugDescripcion.value.trim(),
            estado: 'Abierto',
            fechaReporte: serverTimestamp(),
            tester: auth.currentUser?.uid || 'anon',
            evidenciaUrl,
            datos: {
                appId,
                moduloId,
                matrizId,
                casoId: casoActual,
                casoNombre: bugCasoNombre.value,
            },
            solucion: {},
        };

        await addDoc(collection(db, 'bugs'), bug);
        Swal.fire('Reportado', 'El bug fue registrado correctamente.', 'success');
        modalBug?.hide();
    } catch (error) {
        console.error('❌ Error registrando bug:', error);
        Swal.fire('Error', 'No se pudo registrar el bug.', 'error');
    }
});

// --- Inicio ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        Swal.fire({
            icon: 'warning',
            title: 'Sesión expirada',
            text: 'Por favor, inicia sesión nuevamente.',
            confirmButtonColor: '#23223F',
        }).then(() => (window.location.href = 'index.html'));
    } else {
        pintarTituloMatriz();
        cargarCasos();
    }
});
