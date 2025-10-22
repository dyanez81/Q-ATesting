import { db } from './firebase-config.js';
import {
    collection, addDoc, getDocs, updateDoc, deleteDoc, doc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { uploadEvidence } from './evidencias.js';
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';

const params = new URLSearchParams(window.location.search);
const appId = params.get('app');
const moduloId = params.get('modulo');
const matrizId = params.get('matriz');

const tabla = document.querySelector('#tablaCasos tbody');
const form = document.getElementById('formCaso');
const btnNuevo = document.getElementById('btnNuevo');
const modal = new bootstrap.Modal(document.getElementById('modalCaso'));

let editId = null;
let currentTester = null;

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = './index.html';
    } else {
        currentTester = user.email;
        cargarCasos();
    }
});

async function cargarCasos() {
    tabla.innerHTML = '';
    const ref = collection(db, `apps/${appId}/modulos/${moduloId}/matriz/${matrizId}/casos`);
    const snap = await getDocs(ref);
    if (snap.empty) {
        tabla.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No hay casos registrados</td></tr>`;
        return;
    }

    let i = 1;
    snap.forEach((docSnap) => {
        const c = docSnap.data();
        const color = c.Estado === 'Positivo' ? 'success' :
            c.Estado === 'Fallo' ? 'danger' :
                c.Estado === 'Bloqueado' ? 'warning text-dark' : 'secondary';
        const row = `
      <tr>
        <td>${i++}</td>
        <td>${c.NombreDelCaso}</td>
        <td>${c.TipoDePrueba || '-'}</td>
        <td><span class="badge bg-${color} estado">${c.Estado}</span></td>
        <td>${c.Tester || '-'}</td>
        <td>
          ${c.EvidenciaUrl ? `<a href="${c.EvidenciaUrl}" target="_blank" class="btn btn-sm btn-outline-info">📎</a>` : ''}
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
        NombreDelCaso: form.NombreDelCaso.value.trim(),
        Descripcion: form.Descripcion.value.trim(),
        Pasos: form.Pasos.value.trim(),
        TipoDePrueba: form.TipoDePrueba.value.trim(),
        ResultadoEsperado: form.ResultadoEsperado.value.trim(),
        Estado: form.Estado.value,
        Comentarios: form.Comentarios.value.trim(),
        ReferenciaHU: form.ReferenciaHU.value.trim(),
        Tester: currentTester,
        Fecha: serverTimestamp()
    };

    const file = form.Evidencia.files[0];
    if (file) {
        const url = await uploadEvidence(appId, moduloId, matrizId, Date.now(), file);
        if (url) {
            data.EvidenciaNombre = file.name;
            data.EvidenciaUrl = url;
        }
    }

    const ref = collection(db, `apps/${appId}/modulos/${moduloId}/matriz/${matrizId}/casos`);
    if (editId) {
        await updateDoc(doc(db, `${ref.path}/${editId}`), data);
        editId = null;
    } else {
        await addDoc(ref, data);
    }

    modal.hide();
    form.reset();
    cargarCasos();
});

tabla.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;

    if (btn.classList.contains('btnEditar')) {
        editId = id;
        const ref = collection(db, `apps/${appId}/modulos/${moduloId}/matriz/${matrizId}/casos`);
        const snap = await getDocs(ref);
        const caso = snap.docs.find(d => d.id === id)?.data();
        if (caso) {
            for (const key in caso) {
                if (form[key]) form[key].value = caso[key];
            }
            modal.show();
        }
    }

    if (btn.classList.contains('btnBorrar')) {
        if (confirm('¿Eliminar este caso de prueba?')) {
            await deleteDoc(doc(db, `${collection(db, `apps/${appId}/modulos/${moduloId}/matriz/${matrizId}/casos`).path}/${id}`));
            cargarCasos();
        }
    }
});

btnNuevo.addEventListener('click', () => {
    form.reset();
    editId = null;
    modal.show();
});
