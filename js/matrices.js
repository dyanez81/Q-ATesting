// /js/matrices.js
import { db, auth } from './firebase-config.js';
import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';

// --- Referencias DOM ---
const form = document.getElementById('formMatriz');
const modalEl = document.getElementById('modalMatriz');
const modal = new bootstrap.Modal(modalEl);
const appSelect = document.getElementById('appRelacionada');
const tabla = document.querySelector('#tablaMatrices tbody');
const btnRecargar = document.getElementById('btnRecargar'); // 🔄 nuevo botón
let editandoId = null;
let appsCache = [];

// Autenticación
onAuthStateChanged(auth, async (user) => {
    
    if (!user) {
        Swal.fire({
            icon: 'warning',
            title: 'Sesión expirada',
            text: 'Por favor, inicia sesión nuevamente.',
            confirmButtonColor: '#23223F'
        }).then(() => (window.location.href = 'index.html'));
    } else {
        await cargarAppsRelacionadas();   // ← aquí
    }
});

// Botón "Recargar"
document.getElementById('btnRecargar')?.addEventListener('click', async () => {
    await cargarAppsRelacionadas();     // ← y aquí
    Swal.fire({ icon: 'success', title: 'Actualizado', timer: 1200, showConfirmButton: false });
});

// --- Cargar apps y módulos (solo bajo demanda) ---

async function cargarAppsRelacionadas() {
    try {
        if (!appSelect) return;

        // Limpia combo y cache
        appSelect.innerHTML = '<option value="">Cargando aplicaciones...</option>';
        appsCache = [];

        // 1) Lee todas las apps una sola vez
        const appsSnap = await getDocs(collection(db, 'apps'));

        // 2) Para cada app, lee sus módulos
        const promises = appsSnap.docs.map(async (appDoc) => {
            const appData = appDoc.data();
            const modSnap = await getDocs(collection(db, `apps/${appDoc.id}/modulos`));

            const modulos = modSnap.docs.map((m) => ({
                id: m.id,
                ...m.data(),
                appId: appDoc.id,
                appNombre: appData.nombre || 'Sin nombre'
            }));

            appsCache.push(...modulos);
        });

        await Promise.all(promises);

        // 3) Rellena el combo
        appSelect.innerHTML = '<option value="">Seleccionar aplicación...</option>';
        appsCache.forEach((m) => {
            const opt = document.createElement('option');
            opt.value = `${m.appId}|${m.id}`;
            opt.textContent = `${m.appNombre} / ${m.nombre || 'Sin módulo'}`;
            appSelect.appendChild(opt);
        });

        // 4) Carga la tabla
        cargarMatrices();

    } catch (err) {
        console.error('❌ Error al cargar apps relacionadas:', err);
        Swal.fire('Error', 'No se pudieron cargar las aplicaciones.', 'error');
    }
}


// --- Cargar matrices ---
async function cargarMatrices() {
    if (!tabla) return;
    tabla.innerHTML = `
    <tr><td colspan="8" class="text-center text-muted py-4">Cargando matrices...</td></tr>
  `;

    try {
        const matrices = [];

        for (const mod of appsCache) {
            const matsSnap = await getDocs(collection(db, `apps/${mod.appId}/modulos/${mod.id}/matrices`));
            matsSnap.forEach((d) => {
                matrices.push({
                    id: d.id,
                    ...d.data(),
                    appId: mod.appId,
                    appNombre: mod.appNombre,
                    modulo: mod.nombre
                });
            });
        }

        if (!matrices.length) {
            tabla.innerHTML = `
        <tr><td colspan="8" class="text-center text-muted py-4">No hay matrices registradas</td></tr>
      `;
            return;
        }

        matrices.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        let html = '';
        let i = 1;
        matrices.forEach((m) => {
            html += `
        <tr>
          <td>${i++}</td>
          <td>${m.nombre || '-'}</td>
          <td>${m.appNombre || '-'}</td>
          <td>${m.modulo || '-'}</td>
          <td>${m.descripcion || '-'}</td>
          <td>${m.ambiente || '-'}</td>
          <td class="text-center">
            <a href="casos.html?id=${m.id}&app=${m.appId}&modulo=${m.modulo}" class="btn btn-sm btn-outline-info me-2">
              <i class="bi bi-list-check"></i> Casos
            </a>
            <button class="btn btn-sm btn-outline-primary me-2" data-id="${m.id}" data-app="${m.appId}" data-modulo="${m.modulo}" data-action="editar">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" data-id="${m.id}" data-app="${m.appId}" data-modulo="${m.modulo}" data-action="eliminar">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `;
        });

        tabla.innerHTML = html;
    } catch (error) {
        console.error('Error al cargar matrices:', error);
        Swal.fire('Error', 'No se pudieron cargar las matrices.', 'error');
    }
}

// --- Guardar / editar ---
form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const [appId, moduloId] = appSelect.value.split('|');
    if (!appId || !moduloId) {
        Swal.fire('Error', 'Selecciona una aplicación y módulo.', 'warning');
        return;
    }

    const nuevaMatriz = {
        nombre: document.getElementById('nombreMatriz').value.trim(),
        descripcion: document.getElementById('descripcionMatriz').value.trim(),
        ambiente: document.getElementById('ambienteMatriz').value,
        submodulo: document.getElementById('submoduloMatriz').value.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    try {
        const path = `apps/${appId}/modulos/${moduloId}/matrices`;

        if (editandoId) {
            await updateDoc(doc(db, path, editandoId), nuevaMatriz);
            Swal.fire('Actualizado', 'La matriz se actualizó correctamente.', 'success');
        } else {
            await addDoc(collection(db, path), nuevaMatriz);
            Swal.fire('Registrado', 'La matriz se agregó correctamente.', 'success');
        }

        form.reset();
        editandoId = null;
        modal.hide();
        cargarMatrices();
    } catch (error) {
        console.error('Error al guardar matriz:', error);
        Swal.fire('Error', 'No se pudo guardar la matriz.', 'error');
    }
});

// --- Limpiar modal ---
modalEl?.addEventListener('hidden.bs.modal', () => {
    form.reset();
    editandoId = null;
});

// --- Delegación de eventos (editar/eliminar) ---
tabla?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const id = btn.dataset.id;
    const appId = btn.dataset.app;
    const modulo = btn.dataset.modulo;
    const action = btn.dataset.action;

    if (action === 'editar') {
        try {
            const matrizRef = doc(db, `apps/${appId}/modulos/${modulo}/matrices/${id}`);
            const snap = await getDoc(matrizRef);

            if (!snap.exists()) {
                Swal.fire('Error', 'No se encontró la matriz en Firestore.', 'error');
                return;
            }

            const data = snap.data();
            editandoId = id;

            document.getElementById('nombreMatriz').value = data.nombre || '';
            document.getElementById('descripcionMatriz').value = data.descripcion || '';
            document.getElementById('ambienteMatriz').value = data.ambiente || '';
            document.getElementById('submoduloMatriz').value = data.submodulo || '';

            modal.show();
        } catch (err) {
            console.error('❌ Error al cargar matriz para edición:', err);
            Swal.fire('Error', 'No se pudo cargar la matriz para editar.', 'error');
        }
    }

    if (action === 'eliminar') {
        const confirm = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar matriz?',
            text: 'Esta acción no se puede deshacer.',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
        });

        if (!confirm.isConfirmed) return;

        try {
            await deleteDoc(doc(db, `apps/${appId}/modulos/${modulo}/matrices/${id}`));
            Swal.fire('Eliminado', 'La matriz fue eliminada correctamente.', 'success');
            cargarMatrices();
        } catch (err) {
            console.error('❌ Error al eliminar matriz:', err);
            Swal.fire('Error', 'No se pudo eliminar la matriz.', 'error');
        }
    }
});

// --- Recargar manualmente ---
btnRecargar?.addEventListener('click', async () => {
    await cargarAppsRelacionadas();
    Swal.fire({
        icon: 'success',
        title: 'Actualizado',
        text: 'Datos recargados correctamente.',
        timer: 1500,
        showConfirmButton: false,
    });
});
