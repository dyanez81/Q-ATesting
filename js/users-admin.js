import { auth, db } from './firebase-config.js';
import {
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import {
    collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

onAuthStateChanged(auth, (user) => {
    if (!user) {
        Swal.fire({
            icon: 'warning',
            title: 'Sesión expirada',
            text: 'Por favor, inicia sesión nuevamente.'
        }).then(() => window.location.href = './index.html');
        return;
    }

   /* const role = window.currentUser?.role;
    if (!['Administrador', 'Supervisor'].includes(role)) {
        Swal.fire({
            icon: 'error',
            title: 'Acceso denegado',
            text: 'Solo administradores o supervisores pueden acceder a esta sección.'
        }).then(() => window.location.href = './dashboard.html');
        return;
    }*/

    // ✅ Si pasa la validación, ejecuta el resto del código normalmente
    inicializarTablaUsuarios();
});

function inicializarTablaUsuarios() {
    const tbody = document.getElementById('tablaUsuarios');
    const form = document.getElementById('formUsuario');
    let editandoId = null;

    // Escucha en tiempo real
    onSnapshot(collection(db, 'users'), (snapshot) => {
        tbody.innerHTML = '';
        let index = 1;
        snapshot.forEach((docSnap) => {
            const user = docSnap.data();
            const uid = docSnap.id;
            const estadoColor = user.status === 'Activo'
                ? 'success'
                : (user.status === 'Pendiente' ? 'warning text-dark' : 'secondary');
                

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index++}</td>
                <td>${user.name || ''} ${user.lastname || ''}</td>
                <td>${user.email || ''}</td>
                <td>${user.phone || ''}</td>
                <td><span class="badge bg-info text-dark">${user.role || 'Tester'}</span></td>
                <td><span class="badge bg-${estadoColor}">${user.status || 'Pendiente'}</span></td>
                <td>
                  <button class="btn btn-sm btn-outline-success btn-activar" ${user.status === 'Activo' ? 'disabled' : ''}><i class="bi bi-check-circle"></i></button>
                  <button class="btn btn-sm btn-outline-warning btn-desactivar" ${user.status === 'Inactivo' ? 'disabled' : ''}><i class="bi bi-slash-circle"></i></button>
                  <button class="btn btn-sm btn-outline-secondary btn-editar"><i class="bi bi-pencil"></i></button>
                  <button class="btn btn-sm btn-outline-danger btn-borrar"><i class="bi bi-trash"></i></button>
                </td>
            `;

            // Eventos de acción
            row.querySelector('.btn-activar').addEventListener('click', async () => {
                await updateDoc(doc(db, 'users', uid), { status: 'Activo' });
            });
            row.querySelector('.btn-desactivar').addEventListener('click', async () => {
                await updateDoc(doc(db, 'users', uid), { status: 'Inactivo' });
            });
            row.querySelector('.btn-editar').addEventListener('click', () => {
                editandoId = uid;
                document.getElementById('modalUsuarioLabel').textContent = 'Editar Usuario';
                const modal = bootstrap.Modal.getOrCreateInstance('#modalUsuario');
                modal.show();

                document.getElementById('nombreUsuario').value = user.name || '';
                document.getElementById('correoUsuario').value = user.email || '';
                document.getElementById('telefonoUsuario').value = user.phone || '';
                document.getElementById('rolUsuario').value = user.role || 'Tester';
            });
            row.querySelector('.btn-borrar').addEventListener('click', async () => {
                if (confirm(`¿Eliminar usuario ${user.name}?`)) await deleteDoc(doc(db, 'users', uid));
            });
            tbody.appendChild(row);
        });
    });

    // Crear o editar usuario
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nombre = document.getElementById('nombreUsuario').value.trim();
        const correo = document.getElementById('correoUsuario').value.trim();
        const telefono = document.getElementById('telefonoUsuario').value.trim();
        const rol = document.getElementById('rolUsuario').value.trim();
        const data = { name: nombre, email: correo, phone: telefono, role: rol, status: 'Activo' };

        if (editandoId) {
            await updateDoc(doc(db, 'users', editandoId), data);
            editandoId = null;
        } else {
            await addDoc(collection(db, 'users'), data);
        }
        bootstrap.Modal.getInstance(document.getElementById('modalUsuario')).hide();
        form.reset();
    });
}
