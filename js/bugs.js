import { db, auth } from './firebase-config.js';
import {
    collection, getDocs, query, where, updateDoc, doc, serverTimestamp, getDoc
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import Swal from "https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm";

document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.querySelector('#bugsTable tbody');
    const filterStatus = document.getElementById('filterStatus');
    const filterAssignee = document.getElementById('filterAssignee');
    const applyFilters = document.getElementById('applyFilters');

    let currentUserRole = null;
    let currentUserEmail = null;

    // =============================
    // 🔹 Detectar usuario y rol
    // =============================
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserEmail = user.email;
            const ref = doc(db, 'users', user.uid);
            const snap = await getDoc(ref);
            if (snap.exists()) currentUserRole = snap.data().role || 'Tester';
            loadBugs();
        }
    });

    // =============================
    // 🔹 Cargar bugs
    // =============================
    async function loadBugs() {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">Cargando bugs...</td></tr>`;

        const status = filterStatus.value;
        const assignee = filterAssignee.value.trim();
        let constraints = [];
        if (status !== 'Todos') constraints.push(where('estatus', '==', status));
        if (assignee) constraints.push(where('asignadoA', '==', assignee));

        const q = query(collection(db, 'bugs'), ...constraints);
        const snapshot = await getDocs(q);

        tableBody.innerHTML = '';

        if (snapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No se encontraron bugs</td></tr>`;
            return;
        }

        snapshot.forEach(docSnap => {
            const bug = docSnap.data();
            const id = docSnap.id;
            tableBody.insertAdjacentHTML('beforeend', renderBugRow(bug, id));
        });

        attachEventListeners();
    }

    // =============================
    // 🔹 Renderizar fila de bug
    // =============================
    function renderBugRow(bug, id) {
        const fecha = bug.creadoEn?.toDate ? bug.creadoEn.toDate().toLocaleDateString() : 'N/A';
        const canEdit = currentUserRole === 'Desarrollador' || currentUserRole === 'Admin';
        const isMine = bug.reportadoPor === currentUserEmail;

        return `
      <tr class="${isMine ? 'table-primary border-start border-4 border-info' : ''}">
        <td>
          ${bug.titulo}
          ${isMine ? '<span class="badge bg-info text-dark ms-2">🧪 Mío</span>' : ''}
        </td>
        <td>${bug.descripcion}</td>
        <td><span class="badge bg-${getBugStatusColor(bug.estatus)}">${bug.estatus}</span></td>
        <td>${bug.asignadoA || '-'}</td>
        <td>${bug.reportadoPor}</td>
        <td>${bug.caseId}</td>
        <td>${fecha}</td>
        <td class="text-nowrap">
          <button class="btn btn-sm btn-outline-primary me-2" onclick="viewBugDetail('${id}')">👁️</button>
          ${canEdit ? `<button class="btn btn-sm btn-outline-success me-2 save-btn" data-id="${id}">✏️</button>` : ''}
          ${canEdit ? `<button class="btn btn-sm btn-outline-danger delete-btn" data-id="${id}">🗑️</button>` : ''}
        </td>
      </tr>
    `;
    }

    // =============================
    // 🔹 Listeners de botones
    // =============================
    function attachEventListeners() {
        document.querySelectorAll('.save-btn').forEach(btn =>
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                const confirm = await Swal.fire({
                    title: 'Actualizar estatus',
                    input: 'select',
                    inputOptions: {
                        'Abierto': 'Abierto',
                        'En progreso': 'En progreso',
                        'Resuelto': 'Resuelto',
                        'Rechazado': 'Rechazado'
                    },
                    inputPlaceholder: 'Selecciona nuevo estatus',
                    showCancelButton: true,
                    confirmButtonText: 'Guardar',
                    confirmButtonColor: '#23223F'
                });
                if (!confirm.isConfirmed) return;

                await updateDoc(doc(db, 'bugs', id), {
                    estatus: confirm.value,
                    actualizadoEn: serverTimestamp()
                });

                Swal.fire('✅ Actualizado', 'El estatus se cambió correctamente.', 'success');
                loadBugs();
            })
        );

        document.querySelectorAll('.delete-btn').forEach(btn =>
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                const confirm = await Swal.fire({
                    icon: 'warning',
                    title: '¿Eliminar bug?',
                    text: 'Esta acción no se puede deshacer.',
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    cancelButtonColor: '#6c757d',
                    confirmButtonText: 'Sí, eliminar'
                });
                if (!confirm.isConfirmed) return;
                await updateDoc(doc(db, 'bugs', id), { estatus: 'Eliminado' });
                loadBugs();
            })
        );
    }

    // =============================
    // 🔹 Color del estatus
    // =============================
    function getBugStatusColor(status) {
        switch (status) {
            case 'Abierto': return 'danger';
            case 'En progreso': return 'warning text-dark';
            case 'Resuelto': return 'success';
            case 'Rechazado': return 'secondary';
            default: return 'light text-dark';
        }
    }

    // =============================
    // 🔹 Filtros manuales
    // =============================
    applyFilters.addEventListener('click', () => loadBugs());
});
