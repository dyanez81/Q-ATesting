import { db } from './firebase-config.js';
import {
    collection, addDoc, getDocs, updateDoc, deleteDoc, doc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { uploadEvidence } from './evidencias.js';
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';

const tabla = document.querySelector('#tablaBugs tbody');
const form = document.getElementById('formBug');
let editId = null;
let currentUser = null;

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user.email;
        cargarBugs();
    }
});

async function cargarBugs() {
    tabla.innerHTML = '';
    const ref = collection(db, 'bugs');
    const snap = await getDocs(ref);
    if (snap.empty) {
        tabla.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No hay bugs registrados</td></tr>`;
        return;
    }

    let i = 1;
    snap.forEach((docSnap) => {
        const b = docSnap.data();
        const color =
            b.Estado === 'Abierto' ? 'danger' :
                b.Estado === 'En progreso' ? 'warning text-dark' :
                    b.Estado === 'Resuelto' ? 'success' : 'secondary';
        const row = `
      <tr>
        <td>${i++}</td>
        <td>${b.Titulo}</td>
        <td>${b.Severidad}</td>
        <td><span class="badge bg-${color}">${b.Estado}</span></td>
        <td>${b.AsignadoA || '-'}</td>
        <td>${b.Fecha?.toDate?.().toLocaleDateString?.() || '-'}</td>
        <td>
          ${b.EvidenciaUrl ? `<a href="${b.EvidenciaUrl}" target="_blank" class="btn btn-sm btn-outline-info">📎</a>` : ''}
          <button class="btn btn-sm btn-outline-secondary btnEditar" data-id="${docSnap.id}">✏️</button>
          <button class="btn btn-sm btn-outline-danger btnBorrar" data-id="${docSnap.id}">🗑️</button>
        </td>
      </tr>`;
        tabla.insertAdjacentHTML('beforeend', row);
    });
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
        Titulo: form.bugTitulo.value.trim(),
        Severidad: form.bugSeveridad.value,
        Descripcion: form.bugDescripcion.value.trim(),
        Estado: form.bugEstado.value,
        AsignadoA: form.bugAsignado.value.trim(),
        CreadoPor: currentUser,
        Fecha: serverTimestamp()
    };

    const file = form.bugEvidencia.files[0];
    if (file) {
        const url = await uploadEvidence('bugs', 'global', 'global', Date.now(), file);
        data.EvidenciaUrl = url;
        data.EvidenciaNombre = file.name;
    }

    if (editId) {
        await updateDoc(doc(db, `bugs/${editId}`), data);
        editId = null;
    } else {
        await addDoc(collection(db, 'bugs'), data);
    }

    Swal.fire({
        icon: 'success',
        title: 'Bug guardado correctamente',
        confirmButtonColor: '#23223F'
    });

    form.reset();
    document.querySelector('#modalBug .btn-close').click();
    cargarBugs();
});

tabla.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;

    if (btn.classList.contains('btnEditar')) {
        const snap = await getDocs(collection(db, 'bugs'));
        const bug = snap.docs.find((d) => d.id === id)?.data();
        if (bug) {
            form.bugTitulo.value = bug.Titulo;
            form.bugSeveridad.value = bug.Severidad;
            form.bugDescripcion.value = bug.Descripcion;
            form.bugEstado.value = bug.Estado;
            form.bugAsignado.value = bug.AsignadoA || '';
            editId = id;
            new bootstrap.Modal(document.getElementById('modalBug')).show();
        }
    }

    if (btn.classList.contains('btnBorrar')) {
        const confirm = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar bug?',
            text: 'Esta acción no se puede deshacer',
            showCancelButton: true,
            confirmButtonColor: '#23223F',
            cancelButtonColor: '#aaa',
            confirmButtonText: 'Eliminar'
        });

        if (confirm.isConfirmed) {
            await deleteDoc(doc(db, `bugs/${id}`));
            cargarBugs();
        }
    }
});
