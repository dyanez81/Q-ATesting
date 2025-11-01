import { db, auth } from './firebase-config.js';
import {
    collection, addDoc, getDocs, updateDoc, deleteDoc, doc, getDoc, query, orderBy, limit,
    startAfter, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';

const form = document.getElementById('formApp');
const tabla = document.querySelector('#tablaApps tbody');
const modalEl = document.getElementById('modalApp');
const modal = new bootstrap.Modal(modalEl);
//const testerSelect = document.getElementById('testerApp');
const btnRecargar = document.getElementById('btnRecargarApps');
const modalDetalles = new bootstrap.Modal(document.getElementById('modalDetallesApp'));
const detallesCont = document.getElementById('detallesAppContenido');

let editandoId = null;
const PAGE_SIZE = 10;
let lastVisible = null;
let firstVisible = null;
let currentPage = 1;
let lastDocsStack = [];

/*/ --- Cargar testers ---
async function cargarTesters() {
    testerSelect.innerHTML = '<option value="">QA Finsus</option>';
    try {
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (['tester', 'qa'].includes(data.role?.toLowerCase()) || data.isTester) {
                const opt = document.createElement('option');
                opt.value = data.email || docSnap.id;
                opt.textContent = data.name || data.email;
                opt.dataset.uid = docSnap.id;
                testerSelect.appendChild(opt);
            }
        });
    } catch (err) {
        console.error('Error cargando testers:', err);
    }
}*/

// --- Cargar Apps ---
async function cargarApps(pagina = 1, direction = 'next') {
    tabla.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Cargando aplicaciones...</td></tr>`;
    try {
        let q;
        const ref = collection(db, 'apps');

        if (pagina === 1 && direction === 'next') {
            q = query(ref, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
            lastDocsStack = [];
        } else if (direction === 'next' && lastVisible) {
            q = query(ref, orderBy('createdAt', 'desc'), startAfter(lastVisible), limit(PAGE_SIZE));
        } else if (direction === 'prev' && lastDocsStack.length > 0) {
            const prevCursor = lastDocsStack.pop();
            q = query(ref, orderBy('createdAt', 'desc'), startAfter(prevCursor), limit(PAGE_SIZE));
            currentPage--;
        }

        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            tabla.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No hay aplicaciones registradas.</td></tr>`;
            return;
        }

        firstVisible = snapshot.docs[0];
        lastVisible = snapshot.docs[snapshot.docs.length - 1];
        if (direction === 'next') lastDocsStack.push(firstVisible);

        tabla.innerHTML = '';
        let i = (currentPage - 1) * PAGE_SIZE + 1;
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const fecha = data.fechaFin ? new Date(data.fechaFin.toDate()).toLocaleDateString('es-MX') : '-';
            tabla.insertAdjacentHTML('beforeend', `
        <tr>
          <td>${i++}</td>
          <td>${data.nombre || '-'}</td>
          <td>${data.tipo || '-'}</td>
          <td>${data.testerNombre || data.tester || 'QA Finsus'}</td>
          <td>${fecha}</td>
          <td class="text-center">
            <button class="btn btn-sm btn-outline-dark me-2" data-id="${docSnap.id}" data-action="detalles" title="Detalles">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-sm btn-outline-primary me-2" data-id="${docSnap.id}" data-action="editar" title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" data-id="${docSnap.id}" data-action="eliminar" title="Eliminar">
              <i class="bi bi-trash"></i>
            </button>
            <button class="btn btn-sm btn-outline-info me-2" data-id="${docSnap.id}" data-action="requerimientos">
                <i class="bi bi-diagram-2"></i> 
            </button>
          </td>
        </tr>
      `);
        });
        document.getElementById('paginaActual').textContent = `Página ${currentPage}`;
    } catch (err) {
        console.error('Error al cargar apps:', err);
    }
}

// --- Guardar / editar App ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const sel = document.getElementById('testerApp');
    const nuevaApp = {
        nombre: nombreApp.value.trim(),
        tipo: tipoApp.value.trim(),
        tester: sel?.value || '',
        testerNombre: sel?.textContent || '',
        //testerUid: sel?.dataset.uid || '',
        estatus: true,
        fechaFin: fechaFinApp.value ? new Date(fechaFinApp.value) : null,
        updatedAt: serverTimestamp(),
    };

    try {
        if (editandoId) {
            await updateDoc(doc(db, 'apps', editandoId), nuevaApp);
            Swal.fire('Actualizado', 'Aplicación modificada correctamente.', 'success');
        } else {
            await addDoc(collection(db, 'apps'), { ...nuevaApp, createdAt: serverTimestamp() });
            Swal.fire('Registrado', 'Aplicación creada correctamente.', 'success');
        }
        form.reset();
        editandoId = null;
        modal.hide();
        await cargarApps(currentPage);
    } catch {
        Swal.fire('Error', 'No se pudo guardar la aplicación.', 'error');
    }
});

// --- Editar / Eliminar / Detalles ---
tabla.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'editar') {
        const ref = doc(db, 'apps', id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const data = snap.data();
            //await cargarTesters();
            nombreApp.value = data.nombre || '';
            tipoApp.value = data.tipo || '';
            //testerSelect.value = data.tester || '';
            fechaFinApp.value = data.fechaFin ? new Date(data.fechaFin.toDate()).toISOString().split('T')[0] : '';
            editandoId = id;
            modal.show();
        }
    }

    if (action === 'eliminar') {
        const conf = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar aplicación?',
            text: 'Esta acción no se puede deshacer.',
            showCancelButton: true,
            confirmButtonText: 'Eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#d33'
        });
        if (conf.isConfirmed) {
            await deleteDoc(doc(db, 'apps', id));
            Swal.fire('Eliminada', 'Aplicación borrada correctamente.', 'success');
            await cargarApps(currentPage);
        }
    }

    if (action === 'detalles') {
        const ref = doc(db, 'apps', id);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const data = snap.data();
        const fecha = data.fechaFin ? new Date(data.fechaFin.toDate()).toLocaleDateString('es-MX') : '-';

        // Contar requerimientos
        const reqSnap = await getDocs(collection(db, `apps/${id}/requerimientos`));
        const reqCount = reqSnap.size;

        detallesCont.innerHTML = `
      <ul class="list-group list-group-flush">
        <li class="list-group-item"><strong>Nombre:</strong> ${data.nombre}</li>
        <li class="list-group-item"><strong>Tipo:</strong> ${data.tipo}</li>
        <li class="list-group-item"><strong>Tester:</strong> ${data.testerNombre || data.tester}</li>
        <li class="list-group-item"><strong>Fecha Fin:</strong> ${fecha}</li>
        <li class="list-group-item"><strong>Requerimientos asociados:</strong> ${reqCount}</li>
        <li class="list-group-item"><strong>Creado:</strong> ${data.createdAt ? new Date(data.createdAt.toDate()).toLocaleString() : '-'}</li>
        <li class="list-group-item"><strong>Última actualización:</strong> ${data.updatedAt ? new Date(data.updatedAt.toDate()).toLocaleString() : '-'}</li>
      </ul>
    `;
        modalDetalles.show();
    }

    if (action === 'requerimientos') {
        window.location.href = `requerimientos.html?appId=${id}`;
    }

});

btnRecargar?.addEventListener('click', () => cargarApps(1));
document.getElementById('nextPage')?.addEventListener('click', async () => { currentPage++; await cargarApps(currentPage, 'next'); });
document.getElementById('prevPage')?.addEventListener('click', async () => { if (currentPage > 1) { currentPage--; await cargarApps(currentPage, 'prev'); } });

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        Swal.fire({ icon: 'warning', title: 'Sesión expirada', text: 'Por favor inicia sesión.' }).then(() => location.href = 'index.html');
    } else {
        //await cargarTesters();
        await cargarApps(1);
    }
});
