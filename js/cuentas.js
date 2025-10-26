// /js/cuentas.js
import { db, auth } from './firebase-config.js';
import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    onSnapshot,
    query,
    orderBy,
    limit,
    serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';

const tabla = document.querySelector('#tablaCuentas tbody');
const formCuenta = document.getElementById('formCuenta');
const modalCuenta = new bootstrap.Modal(document.getElementById('modalCuenta'));
const modalComentarios = new bootstrap.Modal(document.getElementById('modalComentarios'));
const modalAsignar = new bootstrap.Modal(document.getElementById('modalAsignar'));

let editandoId = null;
let cuentaSeleccionada = null;

// --- Verificar sesión ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        Swal.fire({
            icon: 'warning',
            title: 'Sesión expirada',
            text: 'Por favor, inicia sesión nuevamente.',
            confirmButtonColor: '#23223F',
        }).then(() => (window.location.href = 'index.html'));
    } else {
        cargarCuentas();
    }
});
document.getElementById('nextPage')?.addEventListener('click', async () => {
    currentPage++;
    await cargarCuentas(currentPage, 'next');
});

document.getElementById('prevPage')?.addEventListener('click', async () => {
    if (currentPage > 1) {
        currentPage--;
        await cargarCuentas(currentPage, 'prev');
    }
});

// Cargar primera página al iniciar sesión
onAuthStateChanged(auth, (user) => {
    if (user) cargarCuentas(1);
});


// --- Configuración de paginación ---
const PAGE_SIZE = 10;
let lastVisible = null;
let firstVisible = null;
let currentPage = 1;
let lastDocsStack = [];
// --- Cargar cuentas en tiempo real ---
async function cargarCuentas(pagina = 1, direction = 'next') {
    const ref = collection(db, 'cuentas_pruebas');
    tabla.innerHTML = `<tr><td colspan="12" class="text-center text-muted py-4">Cargando cuentas...</td></tr>`;

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
            tabla.innerHTML = `<tr><td colspan="12" class="text-center text-muted py-4">No hay cuentas registradas.</td></tr>`;
            return;
        }

        // Actualizamos cursores
        firstVisible = snapshot.docs[0];
        lastVisible = snapshot.docs[snapshot.docs.length - 1];
        if (direction === 'next' && snapshot.docs.length > 0) {
            lastDocsStack.push(firstVisible);
        }

        // Renderizado
        tabla.innerHTML = '';
        let i = (currentPage - 1) * PAGE_SIZE + 1;

        snapshot.forEach((docSnap) => {
            const c = docSnap.data();
            const car = c.caracteristicas || {};

            // 🎨 Badge dinámico por estatus
            let badgeClass = 'secondary';
            if (c.estatus === 'Activa') badgeClass = 'success';
            else if (c.estatus === 'Pendiente') badgeClass = 'warning';
            else if (c.estatus === 'Baja') badgeClass = 'danger';
            else if (c.estatus === 'PLD') badgeClass = 'info';

            const fila = `
        <tr>
          <td>${i++}</td>
          <td>${c.telefono || '—'}</td>
          <td>${c.correo || '—'}</td>
          <td>${c.tipoCuenta || '—'}</td>
          <td><span class="badge bg-${badgeClass}">${c.estatus}</span></td>
          <td>$${car.saldo?.toLocaleString() || 0}</td>
          <td>${car.inversiones ? '✔️' : '—'}</td>
          <td>${car.tdd ? '✔️' : '—'}</td>
          <td>${car.tdc ? '✔️' : '—'}</td>
          <td>${car.tdcg ? '✔️' : '—'}</td>
          <td>${c.asignadoA?.[0]?.nombre || '—'}</td>
          <td class="text-center">
            <button class="btn btn-sm btn-outline-primary me-2" data-id="${docSnap.id}" data-action="editar" title="Editar cuenta">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary me-2" data-id="${docSnap.id}" data-action="asignar" title="Asignar usuario">
              <i class="bi bi-person-plus"></i>
            </button>
            <button class="btn btn-sm btn-outline-info me-2" data-id="${docSnap.id}" data-action="comentarios" title="Ver comentarios">
              <i class="bi bi-chat-dots"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" data-id="${docSnap.id}" data-action="eliminar" title="Eliminar cuenta">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `;
            tabla.insertAdjacentHTML('beforeend', fila);
        });

        document.getElementById('paginaActual').textContent = `Página ${currentPage}`;
    } catch (err) {
        console.error('❌ Error cargando cuentas:', err);
        Swal.fire('Error', 'No se pudieron cargar las cuentas de prueba.', 'error');
    }
}

// --- Generar datos automáticos ---
function generarDatos() {
    const fecha = new Date();
    const dd = String(fecha.getDate()).padStart(2, '0');
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    const min = String(fecha.getMinutes()).padStart(2);
    const yy = String(fecha.getFullYear());
    const consecutivoCorreo = ''
    function getRandomIntInclusive(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1) + min);
    }
    const consecutivo = getRandomIntInclusive(10, 99);

    const telefono = `${dd}${mm}${yy.slice(-2)}${min}${consecutivo}`;
    const correo = `pruebasqafin+${consecutivoCorreo}@gmail.com`;

    document.getElementById('telefonoCuenta').value = telefono;
    document.getElementById('correoCuenta').value = correo;
}

// --- Guardar / Editar cuenta ---
formCuenta.addEventListener('submit', async (e) => {
    e.preventDefault();

    const tipoCuenta = document.getElementById('tipoCuenta').value;
    const estatus = document.getElementById('estatusCuenta').value;
    const saldo = parseFloat(document.getElementById('saldoCuenta').value || 0);
    const caracteristicas = {
        inversiones: document.getElementById('invCuenta').checked,
        tdd: document.getElementById('tddCuenta').checked,
        tdc: document.getElementById('tdcCuenta').checked,
        tdcg: document.getElementById('tdcgCuenta').checked,
        saldo
    };

    const cuenta = {
        telefono: document.getElementById('telefonoCuenta').value,
        correo: document.getElementById('correoCuenta').value,
        contraseña: 'PruebasDev153$',
        tipoCuenta,
        estatus,
        caracteristicas,
        comentarios: [],
        asignadoA: [],
        updatedAt: serverTimestamp()
    };

    try {
        if (editandoId) {
            await updateDoc(doc(db, 'cuentas_pruebas', editandoId), cuenta);
            Swal.fire('Actualizada', 'La cuenta fue actualizada correctamente.', 'success');
        } else {
            cuenta.createdAt = serverTimestamp();
            await addDoc(collection(db, 'cuentas_pruebas'), cuenta);
            Swal.fire('Registrada', 'La cuenta fue creada correctamente.', 'success');
        }

        formCuenta.reset();
        modalCuenta.hide();
    } catch (err) {
        console.error('Error guardando cuenta:', err);
        Swal.fire('Error', 'No se pudo guardar la cuenta.', 'error');
    }
});

// --- Delegación de eventos en tabla ---
tabla.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'editar') editarCuenta(id);
    if (action === 'eliminar') eliminarCuenta(id);
    if (action === 'comentarios') abrirComentarios(id);
    if (action === 'asignar') abrirAsignacion(id);
});

// --- Editar cuenta ---
async function editarCuenta(id) {
    try {
        const ref = doc(db, 'cuentas_pruebas', id);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const c = snap.data();
        editandoId = id;

        document.getElementById('telefonoCuenta').value = c.telefono || '';
        document.getElementById('correoCuenta').value = c.correo || '';
        document.getElementById('tipoCuenta').value = c.tipoCuenta || '';
        document.getElementById('estatusCuenta').value = c.estatus || '';
        document.getElementById('saldoCuenta').value = c.caracteristicas?.saldo || 0;
        document.getElementById('invCuenta').checked = c.caracteristicas?.inversiones || false;
        document.getElementById('tddCuenta').checked = c.caracteristicas?.tdd || false;
        document.getElementById('tdcCuenta').checked = c.caracteristicas?.tdc || false;
        document.getElementById('tdcgCuenta').checked = c.caracteristicas?.tdcg || false;

        modalCuenta.show();
    } catch (err) {
        console.error('Error al editar cuenta:', err);
    }
}

// --- Eliminar cuenta ---
async function eliminarCuenta(id) {
    const confirm = await Swal.fire({
        icon: 'warning',
        title: '¿Eliminar cuenta?',
        text: 'Esta acción no se puede deshacer.',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
    });
    if (!confirm.isConfirmed) return;

    try {
        await deleteDoc(doc(db, 'cuentas_pruebas', id));
        Swal.fire('Eliminada', 'La cuenta fue eliminada correctamente.', 'success');
    } catch (err) {
        console.error('Error eliminando cuenta:', err);
    }
}

// --- Modal de comentarios ---
async function abrirComentarios(id) {
    cuentaSeleccionada = id;
    const contenedor = document.getElementById('historialComentarios');
    contenedor.innerHTML = '<p class="text-muted">Cargando comentarios...</p>';

    const ref = doc(db, 'cuentas_pruebas', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        contenedor.innerHTML = '<p class="text-muted">No hay comentarios.</p>';
        return;
    }

    const data = snap.data();
    const comentarios = data.comentarios || [];

    if (!comentarios.length) {
        contenedor.innerHTML = '<p class="text-muted">No hay comentarios registrados.</p>';
    } else {
        contenedor.innerHTML = comentarios
            .map(
                (c) => `
        <div class="border rounded p-2 mb-2 bg-light">
          <small class="text-secondary">${new Date(c.fecha.seconds * 1000).toLocaleString()}</small><br>
          <strong>${c.autor}</strong>: ${c.texto}
        </div>
      `
            )
            .join('');
    }

    modalComentarios.show();
}

// --- Agregar comentario ---
document.getElementById('btnAgregarComentario').addEventListener('click', async () => {
    const texto = document.getElementById('nuevoComentario').value.trim();
    if (!texto) return Swal.fire('Atención', 'El comentario no puede estar vacío.', 'warning');

    const user = auth.currentUser;
    const nuevoComentario = {
        texto,
        autor: user?.email || 'Tester',
        fecha: new Date(),
    };

    try {
        const ref = doc(db, 'cuentas_pruebas', cuentaSeleccionada);
        const snap = await getDoc(ref);
        const data = snap.exists() ? snap.data() : {};
        const comentarios = data.comentarios ? [...data.comentarios, nuevoComentario] : [nuevoComentario];

        await updateDoc(ref, { comentarios, updatedAt: serverTimestamp() });
        document.getElementById('nuevoComentario').value = '';
        abrirComentarios(cuentaSeleccionada);
    } catch (err) {
        console.error('Error agregando comentario:', err);
    }
});

// --- Modal Asignar Usuario ---
async function abrirAsignacion(id) {
    cuentaSeleccionada = id;
    document.getElementById('formAsignar').reset();
    modalAsignar.show();
}

document.getElementById('formAsignar').addEventListener('submit', async (e) => {
    e.preventDefault();

    const asignado = [{
        nombre: document.getElementById('nombreAsignado').value.trim(),
        apellidos: document.getElementById('apellidosAsignado').value.trim(),
        telefono: document.getElementById('telefonoAsignado').value.trim(),
        estatus: document.getElementById('estatusAsignado').value,
    }];

    try {
        const ref = doc(db, 'cuentas_pruebas', cuentaSeleccionada);
        await updateDoc(ref, { asignadoA: asignado, updatedAt: serverTimestamp() });
        Swal.fire('Asignado', 'Usuario asignado correctamente.', 'success');
        modalAsignar.hide();
    } catch (err) {
        console.error('Error asignando usuario:', err);
    }
});

// --- Limpiar modal ---
document.getElementById('btnNuevaCuenta')?.addEventListener('click', generarDatos);
document.getElementById('modalCuenta')?.addEventListener('hidden.bs.modal', () => {
    formCuenta.reset();
    editandoId = null;
});
