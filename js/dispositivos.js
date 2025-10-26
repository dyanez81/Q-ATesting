// /js/dispositivos.js
import { db } from './firebase-config.js';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    getDoc,
    query,
    orderBy,
    limit,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm';

const tabla = document.querySelector('#tablaDispositivos tbody');
const form = document.getElementById('formDispositivo');
const modalEl = document.getElementById('modalDispositivo');
const modal = new bootstrap.Modal(modalEl);
const selectAsignado = document.getElementById('asignadoA');
const inputManual = document.getElementById('asignadoManual');
let editandoId = null;

// --- Cargar usuarios testers/desarrolladores ---
async function cargarUsuarios() {
    try {
        const snapshot = await getDocs(collection(db, 'users'));
        selectAsignado.innerHTML = `
      <option value="">Seleccionar usuario...</option>
      <option value="manual">Otro (escribir manualmente)</option>
    `;
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (['Tester', 'Desarrollador'].includes(data.role)) {
                const opt = document.createElement('option');
                opt.value = data.name || data.email;
                opt.textContent = `${data.name || data.email} (${data.role})`;
                selectAsignado.appendChild(opt);
            }
        });
    } catch (err) {
        console.error('Error al cargar usuarios:', err);
    }
}

// --- Mostrar/ocultar campo manual ---
selectAsignado.addEventListener('change', () => {
    if (selectAsignado.value === 'manual') {
        inputManual.classList.remove('d-none');
    } else {
        inputManual.classList.add('d-none');
        inputManual.value = '';
    }
});

// --- Configuración de paginación ---
const PAGE_SIZE = 10;
let lastVisible = null;
let firstVisible = null;
let currentPage = 1;
let lastDocsStack = [];

// --- Cargar tabla de dispositivos con paginación ---
async function cargarDispositivos(pagina = 1, direction = 'next') {
    const ref = collection(db, 'dispositivos');
    tabla.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">Cargando dispositivos...</td></tr>`;

    try {
        let q;

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
            tabla.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-4">No hay dispositivos registrados.</td></tr>`;
            return;
        }

        // Actualizamos cursores
        firstVisible = snapshot.docs[0];
        lastVisible = snapshot.docs[snapshot.docs.length - 1];
        if (direction === 'next' && snapshot.docs.length > 0) {
            lastDocsStack.push(firstVisible);
        }

        // Renderizado de tabla
        tabla.innerHTML = '';
        let i = (currentPage - 1) * PAGE_SIZE + 1;

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();

            const estado = (data.estado || 'Disponible').toLowerCase();
            let badge = `
        <span class="badge bg-secondary d-flex align-items-center justify-content-center gap-1">
          <i class="bi bi-question-circle-fill"></i> ${data.estado || 'Desconocido'}
        </span>
      `;

            if (estado === 'disponible') {
                badge = `
          <span class="badge bg-success d-flex align-items-center justify-content-center gap-1">
            <i class="bi bi-check-circle-fill"></i> Disponible
          </span>
        `;
            } else if (estado === 'asignado') {
                badge = `
          <span class="badge bg-primary d-flex align-items-center justify-content-center gap-1">
            <i class="bi bi-person-badge-fill"></i> Asignado
          </span>
        `;
            } else if (estado === 'dañado') {
                badge = `
          <span class="badge bg-danger d-flex align-items-center justify-content-center gap-1">
            <i class="bi bi-exclamation-triangle-fill"></i> Dañado
          </span>
        `;
            }

            const fila = `
        <tr>
          <td>${i++}</td>
          <td>${data.tipo || '-'}</td>
          <td>${data.marca || '-'}</td>
          <td>${data.modelo || '-'}</td>
          <td>${data.sistemaOperativo || '-'}</td>
          <td>${data.version || '-'}</td>
          <td>${data.asignadoA || 'Finsus'}</td>
          <td>${badge}</td>
          <td class="text-center">
            <button class="btn btn-sm btn-outline-primary me-2" data-id="${docSnap.id}" data-action="editar">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" data-id="${docSnap.id}" data-action="eliminar">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `;
            tabla.insertAdjacentHTML('beforeend', fila);
        });

        document.getElementById('paginaActual').textContent = `Página ${currentPage}`;
    } catch (err) {
        console.error('Error al cargar dispositivos:', err);
        Swal.fire('Error', 'No se pudieron cargar los dispositivos.', 'error');
    }
}


// --- Guardar / editar dispositivo ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const asignado = selectAsignado.value === 'manual'
        ? inputManual.value.trim()
        : selectAsignado.value;

    const dispositivo = {
        tipo: document.getElementById('tipoDispositivo').value.trim(),
        marca: document.getElementById('marcaDispositivo').value.trim(),
        modelo: document.getElementById('modeloDispositivo').value.trim(),
        sistemaOperativo: document.getElementById('soDispositivo').value.trim(),
        version: document.getElementById('versionDispositivo').value.trim(),
        asignadoA: asignado || '',
        estado: document.getElementById('estadoDispositivo').value || 'Disponible',
        updatedAt: serverTimestamp()
    };

    try {
        if (editandoId) {
            await updateDoc(doc(db, 'dispositivos', editandoId), dispositivo);
            Swal.fire('Actualizado', 'El dispositivo se actualizó correctamente.', 'success');
        } else {
            dispositivo.createdAt = serverTimestamp();
            await addDoc(collection(db, 'dispositivos'), dispositivo);
            Swal.fire('Registrado', 'El dispositivo se agregó correctamente.', 'success');
        }

        form.reset();
        inputManual.classList.add('d-none');
        editandoId = null;
        modal.hide();
        cargarDispositivos();
    } catch (err) {
        console.error('Error al guardar dispositivo:', err);
        Swal.fire('Error', 'No se pudo guardar el dispositivo.', 'error');
    }
});

// --- Editar / Eliminar ---
tabla.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'editar') {
        try {
            const ref = doc(db, 'dispositivos', id);
            const snap = await getDoc(ref);
            if (!snap.exists()) return;

            const data = snap.data();
            editandoId = id;

            document.getElementById('tipoDispositivo').value = data.tipo || '';
            document.getElementById('marcaDispositivo').value = data.marca || '';
            document.getElementById('modeloDispositivo').value = data.modelo || '';
            document.getElementById('soDispositivo').value = data.sistemaOperativo || '';
            document.getElementById('versionDispositivo').value = data.version || '';
            document.getElementById('estadoDispositivo').value = data.estado || 'Disponible';

            // --- Asignado ---
            const existe = Array.from(selectAsignado.options).some(opt => opt.value === data.asignadoA);
            if (data.asignadoA && !existe) {
                selectAsignado.value = 'manual';
                inputManual.classList.remove('d-none');
                inputManual.value = data.asignadoA;
            } else {
                selectAsignado.value = data.asignadoA || '';
                inputManual.classList.add('d-none');
            }

            modal.show();
        } catch (err) {
            console.error('Error al editar dispositivo:', err);
            Swal.fire('Error', 'No se pudo cargar el dispositivo para editar.', 'error');
        }
    }

    if (action === 'eliminar') {
        const confirm = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar dispositivo?',
            text: 'Esta acción no se puede deshacer.',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });
        if (!confirm.isConfirmed) return;

        try {
            await deleteDoc(doc(db, 'dispositivos', id));
            Swal.fire('Eliminado', 'El dispositivo fue eliminado correctamente.', 'success');
            cargarDispositivos();
        } catch (err) {
            console.error('Error al eliminar dispositivo:', err);
            Swal.fire('Error', 'No se pudo eliminar el dispositivo.', 'error');
        }
    }
});

// --- Exportar a Excel ---
document.getElementById('btnExportarExcel').addEventListener('click', async () => {
    const data = [];
    const snapshot = await getDocs(collection(db, 'dispositivos'));
    snapshot.forEach(docSnap => {
        const d = docSnap.data();
        data.push({
            Tipo: d.tipo || '',
            Marca: d.marca || '',
            Modelo: d.modelo || '',
            SO: d.sistemaOperativo || '',
            Versión: d.version || '',
            AsignadoA: d.asignadoA || '',
            Estado: d.estado || '',
            FechaRegistro: d.createdAt?.toDate().toLocaleString() || ''
        });
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Dispositivos');
    XLSX.writeFile(wb, `Inventario_Dispositivos_${new Date().toISOString().slice(0, 10)}.xlsx`);
});

// --- Reset modal ---
modalEl.addEventListener('hidden.bs.modal', () => {
    form.reset();
    inputManual.classList.add('d-none');
    editandoId = null;
});

// --- Inicialización ---
(async () => {
    await cargarUsuarios();
    await cargarDispositivos();
})();
// --- Eventos de paginación ---
document.getElementById('nextPage')?.addEventListener('click', async () => {
    currentPage++;
    await cargarDispositivos(currentPage, 'next');
});

document.getElementById('prevPage')?.addEventListener('click', async () => {
    if (currentPage > 1) {
        currentPage--;
        await cargarDispositivos(currentPage, 'prev');
    }
});

// --- Inicialización ---
(async () => {
    await cargarUsuarios();
    await cargarDispositivos(1);
})();
