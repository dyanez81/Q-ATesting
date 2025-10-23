import { db } from './firebase-config.js';
import {
    collection,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';

const tablaUsuarios = document.getElementById('tablaUsuarios');
const formUsuario = document.getElementById('formUsuario');
const modalEl = document.getElementById('modalUsuario');
const modalUsuario = new bootstrap.Modal(modalEl);
const usuariosRef = collection(db, 'users');
const modalTitle = document.getElementById('modalUsuarioLabel');

let editando = null;

// 🧩 Cargar lista de usuarios
async function cargarUsuarios() {
    tablaUsuarios.innerHTML = '<tr><td colspan="7" class="text-center">Cargando usuarios...</td></tr>';
    const snapshot = await getDocs(usuariosRef);
    tablaUsuarios.innerHTML = '';

    let i = 1;
    snapshot.forEach((userDoc) => {
        const data = userDoc.data();
        const activo = data.status === 'Activo';

        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td>${i++}</td>
      <td>${data.name || '-'}</td>
      <td>${data.email || '-'}</td>
      <td>${data.phone || '-'}</td>
      <td>${data.role || '-'}</td>
      <td><span class="badge ${activo ? 'bg-success' : 'bg-secondary'}">${activo ? 'Activo' : 'Inactivo'}</span></td>
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
    `;
        tablaUsuarios.appendChild(tr);
    });
}

// 🧩 Escuchar clics en la tabla
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
            await updateDoc(ref, { status: newStatus });
            Swal.fire({
                icon: 'success',
                title: `Usuario ${newStatus}`,
                timer: 1500,
                showConfirmButton: false
            });
            cargarUsuarios();
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
                    cargarUsuarios();
                }
            });
            break;
    }
});
// 🧩 Resetear modal cuando se abre para nuevo usuario
modalEl.addEventListener('show.bs.modal', () => {
    if (!editando) {
        modalTitle.textContent = 'Agregar Usuario';
        formUsuario.reset();
    }
});

// 🧩 Limpiar formulario al cerrar el modal
modalEl.addEventListener('hidden.bs.modal', () => {
    formUsuario.reset();
    modalTitle.textContent = 'Agregar Usuario';
    editando = null;
});


// 🧩 Guardar usuario (crear o editar)
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
                role: rol
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
        modalTitle.textContent = 'Agregar Usuario';
        editando = null;
        cargarUsuarios();
    } catch (err) {
        console.error(err);
        Swal.fire('Error', 'Ocurrió un error al guardar los cambios.', 'error');
    }
});

// 🧩 Resetear modal cuando se abre para nuevo usuario
modalEl.addEventListener('show.bs.modal', () => {
    if (!editando) {
        modalTitle.textContent = 'Agregar Usuario';
        formUsuario.reset();
    }
});

cargarUsuarios();
