import { auth, db } from './firebase-config.js';
import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    getDoc,
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

    const id = formTarea.dataset.id;
    const titulo = document.getElementById('titulo').value.trim();
    const descripcion = document.getElementById('descripcion').value.trim();
    const prioridad = document.getElementById('prioridad').value;
    const estado = document.getElementById('estado').value;
    const fechaLimite = document.getElementById('fechaLimite').value;

    if (!titulo) {
        Swal.fire('Campo requerido', 'El título es obligatorio.', 'warning');
        return;
    }

    try {
        if (id) {
            // 🔄 Editar
            await updateDoc(doc(db, `users/${usuarioActual.uid}/tareas`, id), {
                titulo, descripcion, prioridad, estado, fechaLimite: fechaLimite || null, updatedAt: new Date().toISOString()
            });
            Swal.fire({ icon: 'success', title: 'Actualizado', text: 'La tarea se actualizó correctamente.', timer: 1600, showConfirmButton: false });
        } else {
            // 🆕 Crear
            await addDoc(collection(db, `users/${usuarioActual.uid}/tareas`), {
                titulo, descripcion, prioridad, estado: 'Pendiente', fechaCreacion: serverTimestamp(), fechaLimite: fechaLimite || null, creadaPor: usuarioActual.uid
            });
            Swal.fire({ icon: 'success', title: 'Tarea agregada', text: 'La tarea se registró correctamente.', timer: 1600, showConfirmButton: false });
        }

        // Cerrar modal, limpiar y resetear título
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalTarea'));
        modal?.hide();
        formTarea.reset();
        delete formTarea.dataset.id;
        document.getElementById('modalTareaLabel').textContent = 'Nueva Tarea';

        cargarTareas();
    } catch (error) {
        console.error('❌ Error al guardar tarea:', error);
        Swal.fire('Error', 'No se pudo guardar la tarea.', 'error');
    }
});


// 🔹 Cargar y mostrar tareas
// 🔹 Paginación
let page = 1;
const pageSize = 5;
let todasLasTareas = [];

async function cargarTareas() {
    tablaTareas.innerHTML = '<tr><td colspan="6" class="text-center">Cargando...</td></tr>';
    const snapshot = await getDocs(tareasRef);
    todasLasTareas = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    renderTabla();
}

function renderTabla() {
    const total = todasLasTareas.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (page > totalPages) page = totalPages;

    const start = (page - 1) * pageSize;
    const slice = todasLasTareas.slice(start, start + pageSize);

    tablaTareas.innerHTML = slice.map((data, i) => {
        // 🎨 Colores e iconos por prioridad
        let prioridadBadge = `<span class="badge bg-secondary"><i class="bi bi-circle"></i> Sin definir</span>`;
        if (data.prioridad === "Alta") {
            prioridadBadge = `<span class="badge bg-danger"><i class="bi bi-exclamation-triangle-fill me-1"></i> Alta</span>`;
        } else if (data.prioridad === "Media") {
            prioridadBadge = `<span class="badge bg-warning text-dark"><i class="bi bi-exclamation-circle-fill me-1"></i> Media</span>`;
        } else if (data.prioridad === "Baja") {
            prioridadBadge = `<span class="badge bg-success"><i class="bi bi-arrow-down-circle-fill me-1"></i> Baja</span>`;
        }

        // 🟢 Colores por estado
        const estadoBadge = data.estado === "Completada"
            ? `<span class="badge bg-success"><i class="bi bi-check-circle me-1"></i> ${data.estado}</span>`
            : data.estado === "Pendiente"
                ? `<span class="badge bg-warning text-dark"><i class="bi bi-hourglass-split me-1"></i> ${data.estado}</span>`
                : `<span class="badge bg-secondary"><i class="bi bi-dash-circle me-1"></i> ${data.estado || "—"}</span>`;
        return `
            <tr>
                <td>${start + i + 1}</td>
                <td>${data.titulo}</td>
                <td>${prioridadBadge}</td>
                <td>${estadoBadge}</td>
                <td>${data.fechaLimite || '—'}</td>
                <td>
                    <button class="btn btn-sm btn-success me-1" data-id="${data.id}" data-action="completar">
                        <i class="bi bi-check2"></i>
                    </button>
                    <button class="btn btn-sm btn-primary me-1" data-id="${data.id}" data-action="editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" data-id="${data.id}" data-action="eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('') || `<tr><td colspan="6" class="text-center py-3 text-muted">Sin tareas disponibles.</td></tr>`;

    document.getElementById('paginaActual').textContent = `Página ${page} de ${totalPages}`;
}


// Eventos de paginación
document.getElementById('prevPage').addEventListener('click', () => {
    if (page > 1) {
        page--;
        renderTabla();
    }
});

document.getElementById('nextPage').addEventListener('click', () => {
    const totalPages = Math.ceil(todasLasTareas.length / pageSize);
    if (page < totalPages) {
        page++;
        renderTabla();
    }
});


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
// 🔹 Editar tarea (abrir modal con los datos)
// 🔹 Acciones en tabla: completar / editar / eliminar (UNIFICADO)
tablaTareas.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const ref = doc(db, `users/${usuarioActual.uid}/tareas`, id);

    switch (action) {
        case 'completar': {
            await updateDoc(ref, { estado: 'Completada' });
            Swal.fire('✅ Listo', 'Tarea marcada como completada', 'success');
            cargarTareas();
            break;
        }

        case 'editar': {
            const docSnap = await getDoc(ref); // 👈 ya importado
            if (!docSnap.exists()) return;
            const tarea = docSnap.data();

            // Cargar datos al modal de edición (mismo que "Nueva Tarea")
            document.getElementById('titulo').value = tarea.titulo || '';
            document.getElementById('descripcion').value = tarea.descripcion || '';
            document.getElementById('prioridad').value = tarea.prioridad || 'Media';
            document.getElementById('estado').value = tarea.estado || 'Pendiente';
            document.getElementById('fechaLimite').value = tarea.fechaLimite || '';

            // marcar modo edición
            formTarea.dataset.id = id;
            document.getElementById('modalTareaLabel').textContent = 'Editar Tarea';

            // Mostrar modal
            const modal = new bootstrap.Modal(document.getElementById('modalTarea'));
            modal.show();
            break;
        }

        case 'eliminar': {
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
    }
});

// 🔹 Título con fecha corta solo si es NUEVA tarea
const modalTarea = document.getElementById('modalTarea');
modalTarea.addEventListener('show.bs.modal', () => {
    if (!formTarea.dataset.id) {
        const hoy = new Date();
        const fechaCorta = hoy.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
        document.getElementById('titulo').value = `Nueva tarea - ${fechaCorta}`;
        // defaults amables
        document.getElementById('prioridad').value = 'Media';
        document.getElementById('estado').value = 'Pendiente';
    }
});

// 🧩 Fix: eliminar fondo gris (backdrop) después de cerrar el modal
document.getElementById('modalTarea').addEventListener('hidden.bs.modal', () => {
  const backdrops = document.querySelectorAll('.modal-backdrop');
  backdrops.forEach(b => b.remove());
  document.body.classList.remove('modal-open');
  document.body.style.overflow = 'auto';
});

