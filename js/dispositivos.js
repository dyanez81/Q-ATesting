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

// --- Cargar tabla de dispositivos ---
async function cargarDispositivos() {
    const snapshot = await getDocs(collection(db, 'dispositivos'));
    tabla.innerHTML = '';
    let i = 1;

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td>${i++}</td>
      <td>${data.tipo || '-'}</td>
      <td>${data.marca || '-'}</td>
      <td>${data.modelo || '-'}</td>
      <td>${data.sistemaOperativo || '-'}</td>
      <td>${data.version || '-'}</td>
      <td>${data.asignadoA || 'Finsus'}</td>
      <td>${(() => {
                const estado = (data.estado || 'Disponible').toLowerCase();
                if (estado === 'disponible') {
                    return `<span class="badge bg-success d-flex align-items-center justify-content-center gap-1">
                <i class="bi bi-check-circle-fill mr-1"></i> Disponible
              </span>`;
                } else if (estado === 'asignado') {
                    return `<span class="badge bg-primary d-flex align-items-center justify-content-center gap-1">
                <i class="bi bi-person-badge-fill mr-1"></i> Asignado
              </span>`;
                } else if (estado === 'dañado') {
                    return `<span class="badge bg-danger d-flex align-items-center justify-content-center gap-1">
                <i class="bi bi-exclamation-triangle-fill mr-1"></i> Dañado
              </span>`;
                } else {
                    return `<span class="badge bg-secondary d-flex align-items-center justify-content-center gap-1">
                <i class="bi bi-question-circle-fill mr-1"></i> ${data.estado}
              </span>`;
                }
            })()}
        </td>

      <td class="text-center">
        <button class="btn btn-sm btn-outline-primary me-2" data-id="${docSnap.id}" data-action="editar">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" data-id="${docSnap.id}" data-action="eliminar">
          <i class="bi bi-trash"></i>
        </button>
      </td>`;
        tabla.appendChild(tr);
    });
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
