// /js/usuarios.js
import { db } from './firebase-config.js';
import {
    collection,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    getDoc,
    query,
    orderBy,
    limit,
    startAfter,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';

// --- Elementos del DOM ---
const tablaUsuarios = document.querySelector('#tablaUsuarios');
const formUsuario = document.getElementById('formUsuario');
const modalEl = document.getElementById('modalUsuario');
const modalUsuario = new bootstrap.Modal(modalEl);
const modalTitle = document.getElementById('modalUsuarioLabel');
const btnRecargar = document.getElementById('btnRecargarUsuarios');
const usuariosRef = collection(db, 'users');

let editando = null;

// --- Configuración de paginación ---
const PAGE_SIZE = 10;
let lastVisible = null;
let firstVisible = null;
let currentPage = 1;
let lastDocsStack = [];

// 🧩 Cargar lista de usuarios con paginación
async function cargarUsuarios(pagina = 1, direction = 'next') {
    tablaUsuarios.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">Cargando usuarios...</td></tr>`;

    try {
        let q;

        // Primera página
        if (pagina === 1 && direction === 'next') {
            q = query(usuariosRef, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
            lastDocsStack = [];
        }
        // Página siguiente
        else if (direction === 'next' && lastVisible) {
            q = query(usuariosRef, orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(PAGE_SIZE));
        }
        // Página anterior
        else if (direction === 'prev' && lastDocsStack.length > 0) {
            const prevCursor = lastDocsStack.pop();
            q = query(usuariosRef, orderBy('createdAt', 'desc'), startAfter(prevCursor), limit(PAGE_SIZE));
            currentPage--;
        }

        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            tablaUsuarios.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No hay usuarios registrados.</td></tr>`;
            return;
        }

        // Actualiza cursores
        firstVisible = snapshot.docs[0];
        lastVisible = snapshot.docs[snapshot.docs.length - 1];
        if (direction === 'next' && snapshot.docs.length > 0) {
            lastDocsStack.push(firstVisible);
        }

        // Renderiza tabla
        tablaUsuarios.innerHTML = '';
        let i = (currentPage - 1) * PAGE_SIZE + 1;

        snapshot.forEach((userDoc) => {
            const data = userDoc.data();
            const activo = data.status === 'Activo';

            const fila = `
        <tr>
          <td>${i++}</td>
          <td>${data.name || '-'}</td>
          <td>${data.email || '-'}</td>
          <td>${data.phone || '-'}</td>
          <td>${data.role || '-'}</td>
          <td>
            <span class="badge ${activo ? 'bg-success' : 'bg-secondary'}">
              ${activo ? 'Activo' : 'Inactivo'}
            </span>
          </td>
          <td class="text-center">
            <button class="btn btn-sm btn-outline-primary me-1" data-id="${userDoc.id}" data-action="editar" title="Editar">
              <i class="bi bi-pencil-square"></i>
            </button>
            <button class="btn btn-sm ${activo ? 'btn-outline-warning' : 'btn-outline-success'} me-1" data-id="${userDoc.id}" data-action="toggle" title="${activo ? 'Desactivar' : 'Activar'}">
              <i class="bi ${activo ? 'bi-toggle-on' : 'bi-toggle-off'}"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" data-id="${userDoc.id}" data-action="eliminar" title="Eliminar">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `;
            tablaUsuarios.insertAdjacentHTML('beforeend', fila);
        });

        document.getElementById('paginaActual').textContent = `Página ${currentPage}`;
    } catch (err) {
        console.error('❌ Error al cargar usuarios:', err);
        Swal.fire('Error', 'No se pudieron cargar los usuarios.', 'error');
    }
}

// 🧩 Acciones de tabla
tablaUsuarios.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const ref = doc(db, 'users', id);

    switch (action) {
        case 'editar':
            editando = id;
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const data = snap.data();
                document.getElementById('nombreUsuario').value = data.name || '';
                document.getElementById('correoUsuario').value = data.email || '';
                document.getElementById('telefonoUsuario').value = data.phone || '';
                document.getElementById('rolUsuario').value = data.role || 'Tester';
                modalTitle.textContent = 'Editar Usuario';
                modalUsuario.show();
            }
            break;

        case 'toggle':
            const newStatus = btn.title === 'Desactivar' ? 'Inactivo' : 'Activo';
            await updateDoc(ref, { status: newStatus, updatedAt: serverTimestamp() });
            Swal.fire({
                icon: 'success',
                title: `Usuario ${newStatus}`,
                timer: 1500,
                showConfirmButton: false
            });
            cargarUsuarios(currentPage);
            break;

        case 'eliminar':
            Swal.fire({
                icon: 'warning',
                title: '¿Eliminar usuario?',
                text: 'Esta acción no se puede deshacer.',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Eliminar'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    await deleteDoc(ref);
                    Swal.fire('🗑️ Eliminado', 'El usuario fue eliminado correctamente.', 'success');
                    cargarUsuarios(currentPage);
                }
            });
            break;
    }
});

// 🧩 Guardar usuario (editar)
formUsuario.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombre = document.getElementById('nombreUsuario').value.trim();
    const correo = document.getElementById('correoUsuario').value.trim();
    const telefono = document.getElementById('telefonoUsuario').value.trim();
    const rol = document.getElementById('rolUsuario').value;

    try {
        if (editando) {
            const ref = doc(db, 'users', editando);
            await updateDoc(ref, {
                name: nombre,
                email: correo,
                phone: telefono,
                role: rol,
                updatedAt: serverTimestamp()
            });
            Swal.fire({
                icon: 'success',
                title: 'Cambios guardados correctamente',
                timer: 1500,
                showConfirmButton: false
            });
        } else {
            Swal.fire({
                icon: 'info',
                title: 'Solo los administradores pueden registrar nuevos usuarios',
                timer: 1800,
                showConfirmButton: false
            });
        }

        modalUsuario.hide();
        formUsuario.reset();
        editando = null;
        cargarUsuarios(currentPage);
    } catch (err) {
        console.error(err);
        Swal.fire('Error', 'Ocurrió un error al guardar los cambios.', 'error');
    }
});

// 🧩 Reset modal
modalEl.addEventListener('hidden.bs.modal', () => {
    formUsuario.reset();
    modalTitle.textContent = 'Agregar Usuario';
    editando = null;
});

// 🧭 Paginación
document.getElementById('nextPage')?.addEventListener('click', async () => {
    currentPage++;
    await cargarUsuarios(currentPage, 'next');
});

document.getElementById('prevPage')?.addEventListener('click', async () => {
    if (currentPage > 1) {
        currentPage--;
        await cargarUsuarios(currentPage, 'prev');
    }
});

// 🧩 Recargar lista manual
btnRecargar?.addEventListener('click', () => cargarUsuarios(1));

// 🧩 Inicialización
cargarUsuarios(1);
