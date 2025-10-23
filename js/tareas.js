import { auth, db } from './firebase-config.js';
import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';

// 🔹 Referencias de elementos
const tablaTareas = document.querySelector('#tablaTareas tbody');
const formTarea = document.getElementById('formTarea');
let tareasRef;
let usuarioActual = null;

// 🔹 Esperar autenticación
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        Swal.fire({
            icon: 'warning',
            title: 'Sesión expirada',
            text: 'Por favor, inicia sesión nuevamente.',
            confirmButtonColor: '#23223F'
        }).then(() => (window.location.href = 'index.html'));
        return;
    }

    usuarioActual = user;
    tareasRef = collection(db, `users/${user.uid}/tareas`);
    cargarTareas();
});

// 🔹 Crear nueva tarea
formTarea.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!usuarioActual) return;

    const titulo = document.getElementById('titulo').value.trim();
    const descripcion = document.getElementById('descripcion').value.trim();
    const prioridad = document.getElementById('prioridad').value;
    const fechaLimite = document.getElementById('fechaLimite').value;

    if (!titulo) {
        Swal.fire('Campo requerido', 'El título es obligatorio.', 'warning');
        return;
    }

    try {
        await addDoc(tareasRef, {
            titulo,
            descripcion,
            prioridad,
            estado: 'Pendiente',
            fechaCreacion: serverTimestamp(),
            fechaLimite: fechaLimite || null,
            creadaPor: usuarioActual.uid
        });

        Swal.fire({
            icon: 'success',
            title: 'Tarea agregada',
            text: 'La tarea se registró correctamente.',
            timer: 1800,
            showConfirmButton: false
        });

        formTarea.reset();
        cargarTareas();
    } catch (error) {
        console.error('❌ Error al guardar tarea:', error);
        Swal.fire('Error', 'No se pudo guardar la tarea.', 'error');
    }
});

// 🔹 Cargar y mostrar tareas
async function cargarTareas() {
    tablaTareas.innerHTML = '<tr><td colspan="6">Cargando...</td></tr>';
    const snapshot = await getDocs(tareasRef);
    tablaTareas.innerHTML = '';

    let i = 1;
    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const fecha = data.fechaLimite ? data.fechaLimite : '—';
        const row = document.createElement('tr');
        row.innerHTML = `
      <td>${i++}</td>
      <td>${data.titulo}</td>
      <td>${data.prioridad || '—'}</td>
      <td>
        <span class="badge ${data.estado === 'Completada'
                ? 'bg-success'
                : data.estado === 'Pendiente'
                    ? 'bg-warning'
                    : 'bg-secondary'
            }">${data.estado}</span>
      </td>
      <td>${fecha}</td>
      <td>
        <button class="btn btn-sm btn-success me-1" data-id="${docSnap.id}" data-action="completar">
          <i class="bi bi-check2"></i>
        </button>
        <button class="btn btn-sm btn-primary me-1" data-id="${docSnap.id}" data-action="editar">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-danger" data-id="${docSnap.id}" data-action="eliminar">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;
        tablaTareas.appendChild(row);
    });
}

// 🔹 Acciones: completar, editar, eliminar
tablaTareas.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;

    const ref = doc(db, `users/${usuarioActual.uid}/tareas`, id);

    switch (action) {
        case 'completar':
            await updateDoc(ref, { estado: 'Completada' });
            Swal.fire('✅ Listo', 'Tarea marcada como completada', 'success');
            cargarTareas();
            break;

        case 'editar':
            const tareaSnap = await getDocs(tareasRef);
            const tarea = tareaSnap.docs.find((d) => d.id === id)?.data();
            if (!tarea) return;

            const { value: formValues } = await Swal.fire({
                title: 'Editar tarea',
                html: `
          <input id="swalTitulo" class="swal2-input" value="${tarea.titulo}">
          <textarea id="swalDesc" class="swal2-textarea">${tarea.descripcion || ''}</textarea>
        `,
                focusConfirm: false,
                preConfirm: () => ({
                    titulo: document.getElementById('swalTitulo').value,
                    descripcion: document.getElementById('swalDesc').value
                })
            });

            if (formValues) {
                await updateDoc(ref, {
                    titulo: formValues.titulo,
                    descripcion: formValues.descripcion
                });
                Swal.fire('✅ Actualizado', 'La tarea se modificó correctamente', 'success');
                cargarTareas();
            }
            break;

        case 'eliminar':
            Swal.fire({
                icon: 'warning',
                title: '¿Eliminar tarea?',
                text: 'Esta acción no se puede deshacer.',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Eliminar'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    await deleteDoc(ref);
                    Swal.fire('🗑️ Eliminada', 'La tarea se eliminó correctamente', 'success');
                    cargarTareas();
                }
            });
            break;
    }
});
