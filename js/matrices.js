import { db } from './firebase-config.js';
import {
    collection, addDoc, getDocs, updateDoc, deleteDoc, doc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';

const params = new URLSearchParams(window.location.search);
const appId = params.get('app');
const moduloId = params.get('modulo');

const tabla = document.querySelector('#tablaMatrices tbody');
const form = document.getElementById('formMatriz');
const btnNuevaMatriz = document.getElementById('btnNuevaMatriz');

const modal = new bootstrap.Modal(document.getElementById('modalMatriz'));
let editId = null;

async function cargarMatrices() {
    tabla.innerHTML = '';
    const ref = collection(db, `apps/${appId}/modulos/${moduloId}/matriz`);
    const snap = await getDocs(ref);

    if (snap.empty) {
        tabla.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No hay matrices registradas</td></tr>`;
        return;
    }

    let i = 1;
    snap.forEach((docSnap) => {
        const m = docSnap.data();
        const row = `
      <tr>
        <td>${i++}</td>
        <td>${m.nombre}</td>
        <td>${m.descripcion}</td>
        <td>${m.Ambiente}</td>
        <td><span class="badge bg-${m.status === 'Aprobado' ? 'success' : 'secondary'}">${m.status || 'Borrador'}</span></td>
        <td>
          <a href="casos.html?app=${appId}&modulo=${moduloId}&matriz=${docSnap.id}" class="btn btn-sm btn-outline-primary">Casos</a>
          <button class="btn btn-sm btn-outline-secondary btnEditar" data-id="${docSnap.id}">✏️</button>
          <button class="btn btn-sm btn-outline-danger btnBorrar" data-id="${docSnap.id}">🗑️</button>
        </td>
      </tr>`;
        tabla.insertAdjacentHTML('beforeend', row);
    });
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('matrizNombre').value.trim();
    const descripcion = document.getElementById('matrizDescripcion').value.trim();
    const ambiente = document.getElementById('matrizAmbiente').value;

    if (editId) {
        await updateDoc(doc(db, `apps/${appId}/modulos/${moduloId}/matriz/${editId}`), {
            nombre, descripcion, Ambiente: ambiente, updatedAt: serverTimestamp()
        });
        editId = null;
    } else {
        await addDoc(collection(db, `apps/${appId}/modulos/${moduloId}/matriz`), {
            nombre, descripcion, Ambiente: ambiente, createdAt: serverTimestamp(), status: 'Borrador'
        });
    }

    modal.hide();
    form.reset();
    cargarMatrices();
});

tabla.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;

    if (btn.classList.contains('btnEditar')) {
        editId = id;
        const ref = doc(db, `apps/${appId}/modulos/${moduloId}/matriz/${id}`);
        const snap = await getDocs(collection(ref.parent));
        const matriz = snap.docs.find(d => d.id === id)?.data();
        document.getElementById('matrizNombre').value = matriz.nombre;
        document.getElementById('matrizDescripcion').value = matriz.descripcion;
        document.getElementById('matrizAmbiente').value = matriz.Ambiente;
        modal.show();
    }

    if (btn.classList.contains('btnBorrar')) {
        if (confirm('¿Eliminar esta matriz?')) {
            await deleteDoc(doc(db, `apps/${appId}/modulos/${moduloId}/matriz/${id}`));
            cargarMatrices();
        }
    }
});

btnNuevaMatriz.addEventListener('click', () => {
    form.reset();
    editId = null;
    modal.show();
});

onAuthStateChanged(auth, async (user) => {
    if (!user) window.location.href = './index.html';
    await cargarMatrices();
});
