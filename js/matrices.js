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



const tabla = document.getElementById('tablaMatrices');
const form = document.getElementById('formMatriz');
const modal = new bootstrap.Modal(document.getElementById('modalMatriz'));
const modalEl = document.getElementById('modalMatriz');
const appSelect = document.getElementById('appRelacionada');
let editandoId = null;
let appsCache = [];

// --- Verificar sesión ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        Swal.fire({
            icon: 'warning',
            title: 'Sesión expirada',
            text: 'Por favor, inicia sesión nuevamente.',
            confirmButtonColor: '#23223F'
        }).then(() => (window.location.href = 'index.html'));
    } else {
        await cargarAppsRelacionadas();
        await cargarMatrices();
    }
});

// --- Cargar lista de apps para relacionar ---
async function cargarAppsRelacionadas() {
    try {
        const snapshot = await getDocs(collection(db, 'apps'));
        appsCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

        appSelect.innerHTML = '<option value="">Seleccionar aplicación...</option>';
        appsCache.forEach((a) => {
            const opt = document.createElement('option');
            opt.value = a.id;
            opt.textContent = a.nombre || 'App sin nombre';
            appSelect.appendChild(opt);
        });
    } catch (error) {
        console.error('Error al cargar apps relacionadas:', error);
    }
}

// --- Cargar matrices ---
async function cargarMatrices() {
    tabla.innerHTML =
        '<tr><td colspan="8" class="text-center text-muted py-4">Cargando...</td></tr>';

    try {
        const snapshot = await getDocs(collection(db, 'matrices'));

        if (snapshot.empty) {
            tabla.innerHTML =
                '<tr><td colspan="8" class="text-center text-muted py-4">No hay matrices registradas</td></tr>';
            return;
        }

        const matrices = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        matrices.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        let html = '';
        let i = 1;
        matrices.forEach((m) => {
            const app = appsCache.find((a) => a.id === m.appId);
            html += `
        <tr>
          <td>${i++}</td>
          <td>${m.nombre}</td>
          <td>${app ? app.nombre : 'Sin App'}</td>
          <td>${m.descripcion}</td>
          <td>${m.ambiente}</td>
          <td>${m.modulo}</td>
          <td>${m.submodulo || '-'}</td>
          <td class="text-center">
            <a href="casos.html?id=${m.id}" class="btn btn-sm btn-outline-info me-2">
              <i class="bi bi-list-check"></i> Casos
            </a>
            <button class="btn btn-sm btn-outline-primary me-2" data-id="${m.id}" data-action="editar">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" data-id="${m.id}" data-action="eliminar">
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

// --- Guardar o editar matriz ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nuevaMatriz = {
        nombre: document.getElementById('nombreMatriz').value.trim(),
        descripcion: document.getElementById('descripcionMatriz').value.trim(),
        ambiente: document.getElementById('ambienteMatriz').value,
        modulo: document.getElementById('moduloMatriz').value.trim(),
        submodulo: document.getElementById('submoduloMatriz').value.trim(),
        appId: appSelect.value,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    try {
        if (editandoId) {
            const ref = doc(db, 'matrices', editandoId);
            await updateDoc(ref, nuevaMatriz);
            Swal.fire('Actualizado', 'La matriz se actualizó correctamente.', 'success');
        } else {
            await addDoc(collection(db, 'matrices'), nuevaMatriz);
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

// --- Editar o eliminar ---
tabla.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'editar') {
        const ref = doc(db, 'matrices', id);
        const snap = await getDoc(ref);
        if (!snap.exists()) return Swal.fire('Error', 'No se encontró la matriz.', 'error');

        const matriz = snap.data();

        document.getElementById('nombreMatriz').value = matriz.nombre;
        document.getElementById('descripcionMatriz').value = matriz.descripcion;
        document.getElementById('ambienteMatriz').value = matriz.ambiente;
        document.getElementById('moduloMatriz').value = matriz.modulo;
        document.getElementById('submoduloMatriz').value = matriz.submodulo || '';
        appSelect.value = matriz.appId || '';

        editandoId = id;
        document.getElementById('modalMatrizLabel').textContent = 'Editar Matriz';
        modal.show();
    }

    if (action === 'eliminar') {
        const confirmar = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar matriz?',
            text: 'También se eliminarán sus casos asociados.',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Eliminar todo'
        });

        if (confirmar.isConfirmed) {
            try {
                const casosSnapshot = await getDocs(collection(db, `matrices/${id}/casos`));
                const eliminaciones = casosSnapshot.docs.map((c) =>
                    deleteDoc(doc(db, `matrices/${id}/casos/${c.id}`))
                );
                await Promise.all(eliminaciones);

                await deleteDoc(doc(db, 'matrices', id));

                Swal.fire('Eliminada', 'La matriz y sus casos fueron eliminados.', 'success');
                cargarMatrices();
            } catch (error) {
                console.error('Error al eliminar matriz:', error);
                Swal.fire('Error', 'No se pudo eliminar la matriz.', 'error');
            }
        }
    }
});
// 🧩 Resetear modal cuando se abre para nuevo usuario
modalEl.addEventListener('show.bs.modal', () => {
    if (!editando) {
        modalTitle.textContent = 'Agregar Matriz';
        form.reset();
    }
});

// 🧩 Limpiar formulario al cerrar el modal
modalEl.addEventListener('hidden.bs.modal', () => {
    form.reset();
    modalTitle.textContent = 'Agregar Matriz';
    editando = null;
});
