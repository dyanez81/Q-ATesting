// /js/casos.js
import { db, auth } from './firebase-config.js';
import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    getDoc
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js';
import { getApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs";

const storage = getStorage(getApp());

// 🔹 DOM (APUNTA SOLO AL TBODY)
const tbody = document.querySelector('#tablaCasos tbody');
const formCaso = document.getElementById('formCaso');
const modalEl = document.getElementById('modalCaso');
const modalCaso = modalEl ? new bootstrap.Modal(modalEl) : null;
const btnVolver = document.getElementById('btnVolver');
const btnDescargarExcel = document.getElementById('btnDescargarExcel');

let matrizId = null;
let editandoCasoId = null;

// 🔹 Sesión + obtener matrizId desde ?id=...
onAuthStateChanged(auth, (user) => {
    if (!user) {
        Swal.fire({
            icon: 'warning',
            title: 'Sesión expirada',
            text: 'Por favor, inicia sesión nuevamente.',
            confirmButtonColor: '#23223F'
        }).then(() => (window.location.href = 'index.html'));
        return;
    }

    const params = new URLSearchParams(window.location.search);
    matrizId = params.get('id');              // ← unificamos a 'id'
    if (!matrizId) {
        Swal.fire('Error', 'No se ha especificado una matriz.', 'error')
            .then(() => (window.location.href = 'matrices.html'));
        return;
    }

    mostrarNombreMatriz();
    cargarCasos();
});

// 🔹 Volver a matrices
btnVolver?.addEventListener('click', () => (window.location.href = 'matrices.html'));

// 🔹 Cargar casos (subcolección: matrices/{id}/casos)
async function cargarCasos() {
    if (!tbody) return;
    tbody.innerHTML =
        '<tr><td colspan="6" class="text-center text-muted py-4">Cargando...</td></tr>';

    try {
        const snap = await getDocs(collection(db, `matrices/${matrizId}/casos`));
        if (snap.empty) {
            tbody.innerHTML =
                '<tr><td colspan="6" class="text-center text-muted py-4">No hay casos registrados</td></tr>';
            return;
        }

        let html = '';
        let i = 1;
        snap.forEach((d) => {
            const c = d.data();
            html += `
        <tr>
          <td>${i++}</td>
          <td>${c.nombreCaso || '-'}</td>
          <td>${c.tipoPrueba || '-'}</td>
          <td>${c.estado || '-'}</td>
          <td>${c.tester || '-'}</td>
          <td>
            ${c.evidenciaUrl ? `
              <a href="${c.evidenciaUrl}" target="_blank" class="btn btn-sm btn-outline-success me-2" title="Evidencia">
                <i class="bi bi-paperclip"></i>
              </a>` : ''}
            ${renderBotonBug(c.estado, d.id, c.nombreCaso)}
            <button class="btn btn-sm btn-outline-primary me-2" data-id="${d.id}" data-action="editar" title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" data-id="${d.id}" data-action="eliminar" title="Eliminar">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>`;
        });

        tbody.innerHTML = html;
    } catch (e) {
        console.error('Error al cargar casos:', e);
        Swal.fire('Error', 'No se pudieron cargar los casos.', 'error');
    }
}

// 🔹 Guardar / editar caso
formCaso?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const file = document.getElementById('evidenciaCaso')?.files?.[0];
    let evidenciaUrl = null, evidenciaNombre = null;

    if (file) {
        const storageRef = ref(storage, `evidencias/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        evidenciaUrl = await getDownloadURL(storageRef);
        evidenciaNombre = file.name;
    }

    const payload = {
        nombreCaso: document.getElementById('nombreCaso').value.trim(),
        tipoPrueba: document.getElementById('tipoPruebaCaso').value.trim(),
        descripcion: document.getElementById('descripcionCaso').value.trim(),
        precondiciones: document.getElementById('precondicionesCaso').value.trim(),
        pasos: document.getElementById('pasosCaso').value.trim(),
        resultadoEsperado: document.getElementById('resultadoEsperadoCaso').value.trim(),
        estado: document.getElementById('estadoCaso').value,
        comentarios: document.getElementById('comentariosCaso').value.trim(),
        referenciaHU: document.getElementById('referenciaCaso').value.trim(),
        tester: window.currentUser?.name || 'Desconocido',
        evidenciaUrl,
        evidenciaNombre,
        fechaEjecucion: new Date().toLocaleDateString('es-MX'),
        updatedAt: serverTimestamp(),
    };

    try {
        if (editandoCasoId) {
            await updateDoc(doc(db, `matrices/${matrizId}/casos/${editandoCasoId}`), payload);
            Swal.fire('Actualizado', 'El caso se actualizó correctamente.', 'success');
        } else {
            await addDoc(collection(db, `matrices/${matrizId}/casos`), {
                ...payload,
                createdAt: serverTimestamp(),
            });
            Swal.fire('Registrado', 'El caso se agregó correctamente.', 'success');
        }

        formCaso.reset();
        editandoCasoId = null;
        modalCaso?.hide();
        cargarCasos();
    } catch (e) {
        console.error('Error al guardar caso:', e);
        Swal.fire('Error', 'No se pudo guardar el caso.', 'error');
    }
});

// 🔹 Acciones editar / eliminar
tbody?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'editar') {
        // obtener el doc puntual
        const dref = doc(db, `matrices/${matrizId}/casos/${id}`);
        const dsnap = await getDoc(dref);
        if (!dsnap.exists()) return Swal.fire('Error', 'No se encontró el caso.', 'error');

        const c = dsnap.data();
        document.getElementById('nombreCaso').value = c.nombreCaso || '';
        document.getElementById('tipoPruebaCaso').value = c.tipoPrueba || '';
        document.getElementById('descripcionCaso').value = c.descripcion || '';
        document.getElementById('precondicionesCaso').value = c.precondiciones || '';
        document.getElementById('pasosCaso').value = c.pasos || '';
        document.getElementById('resultadoEsperadoCaso').value = c.resultadoEsperado || '';
        document.getElementById('estadoCaso').value = c.estado || 'Pendiente';
        document.getElementById('comentariosCaso').value = c.comentarios || '';
        document.getElementById('referenciaCaso').value = c.referenciaHU || '';

        editandoCasoId = id;
        document.getElementById('modalCasoLabel').textContent = 'Editar Caso de Prueba';
        modalCaso?.show();
    }

    if (action === 'eliminar') {
        const confirmar = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar caso?',
            text: 'Esta acción no se puede deshacer.',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Eliminar',
        });

        if (confirmar.isConfirmed) {
            try {
                await deleteDoc(doc(db, `matrices/${matrizId}/casos/${id}`));
                Swal.fire('Eliminado', 'El caso fue eliminado correctamente.', 'success');
                cargarCasos();
            } catch (e) {
                console.error('Error al eliminar caso:', e);
                Swal.fire('Error', 'No se pudo eliminar el caso.', 'error');
            }
        }
    }
});

// 🔹 Reset modal al abrir/cerrar (modo “nuevo”)
modalEl?.addEventListener('show.bs.modal', () => {
    if (!editandoCasoId) {
        document.getElementById('modalCasoLabel').textContent = 'Agregar Caso de Prueba';
        formCaso?.reset();
    }
});

modalEl?.addEventListener('hidden.bs.modal', () => {
    formCaso?.reset();
    document.getElementById('modalCasoLabel').textContent = 'Agregar Caso de Prueba';
    editandoCasoId = null;
});

// 🔹 Botón Reportar Bug si estado === "Fallo"
function renderBotonBug(estado, idCaso, nombreCaso) {
    if (estado === 'Fallo') {
        return `
      <button class="btn btn-sm btn-outline-danger me-2" onclick="reportarBug('${idCaso}', '${nombreCaso}')">
        <i class="bi bi-bug"></i> Reportar
      </button>`;
    }
    return '';
}

window.reportarBug = async (idCaso, nombreCaso) => {
    const user = auth.currentUser;
    if (!user) {
        return Swal.fire({
            icon: 'warning',
            title: 'Sesión expirada',
            text: 'Por favor inicia sesión nuevamente',
            confirmButtonColor: '#23223F'
        });
    }

    const { value: descripcion } = await Swal.fire({
        title: 'Reportar Bug',
        input: 'textarea',
        inputLabel: `Describe el error detectado en "${nombreCaso}"`,
        inputPlaceholder: 'Ej: Al guardar el formulario aparece un mensaje de error...',
        showCancelButton: true,
        confirmButtonText: 'Crear Bug',
        confirmButtonColor: '#23223F'
    });

    if (descripcion) {
        try {
            await addDoc(collection(db, 'bugs'), {
                titulo: `Bug en caso: ${nombreCaso}`,
                descripcion,
                prioridad: 'Media',
                estatus: 'Abierto',
                idCaso,
                reportadoPor: user.email,
                fechaCreacion: serverTimestamp()
            });
            Swal.fire('Bug registrado', 'El bug se ha creado correctamente.', 'success');
        } catch (e) {
            console.error('Error al crear bug:', e);
            Swal.fire('Error', 'No se pudo registrar el bug.', 'error');
        }
    }
};

// 🔹 Título: nombre de la matriz
async function mostrarNombreMatriz() {
    try {
        const dref = doc(db, 'matrices', matrizId);
        const dsnap = await getDoc(dref);
        const nombre = dsnap.exists() ? (dsnap.data().nombre || '(sin nombre)') : 'Matriz no encontrada';
        const label = document.getElementById('nombreMatriz');
        if (label) label.textContent = `Matriz: ${nombre}`;
    } catch (e) {
        console.error('Error al obtener nombre de matriz:', e);
    }
}

// 🔹 Descargar Excel: TODOS los campos
btnDescargarExcel?.addEventListener('click', async () => {
    try {
        const snap = await getDocs(collection(db, `matrices/${matrizId}/casos`));
        if (snap.empty) {
            return Swal.fire('Sin datos', 'No hay casos en esta matriz', 'info');
        }

        const casos = snap.docs.map(d => d.data());
        const datos = casos.map((c, i) => ({
            '#': i + 1,
            'Nombre del Caso': c.nombreCaso || '',
            'Descripción': c.descripcion || '',
            'Precondiciones / Datos de entrada': c.precondiciones || '',
            'Pasos': c.pasos || '',
            'Tipo de Prueba': c.tipoPrueba || '',
            'Criterio': typeof c.criterio === 'boolean' ? (c.criterio ? '✅ Cumple' : '❌ No cumple') : '',
            'Resultado Esperado': c.resultadoEsperado || '',
            'Tipo': c.tipo || '',
            'Estado': c.estado || '',
            'Fecha de ejecución': c.fechaEjecucion || '',
            'Comentarios': c.comentarios || '',
            'Evidencia Nombre': c.evidenciaNombre || '',
            'Evidencia URL': c.evidenciaUrl || '',
            'Tester': c.tester || '',
            'Referencia HU': c.referenciaHU || '',
            'Fecha': c.fecha || '',
        }));

        const ws = XLSX.utils.json_to_sheet(datos);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Casos');
        XLSX.writeFile(wb, `Matriz_${matrizId}.xlsx`);
    } catch (e) {
        console.error('Error al exportar matriz:', e);
        Swal.fire('Error', 'No se pudo exportar la matriz', 'error');
    }
});
