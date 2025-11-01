import { db, auth } from './firebase-config.js';
import {
    collection, addDoc, getDocs, updateDoc, deleteDoc, doc, getDoc, setDoc,
    query, orderBy, limit, startAfter, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';

const tablaBody = document.querySelector('#tablaMatrices tbody');
const btnRecargar = document.getElementById('btnRecargarMatrices');
const form = document.getElementById('formMatriz');
const modalEl = document.getElementById('modalMatriz');
const modal = modalEl ? new bootstrap.Modal(modalEl) : null;
const appSelect = document.getElementById('appRelacionada');
const modalDetalles = new bootstrap.Modal(document.getElementById('modalDetallesMatriz'));
const detallesCont = document.getElementById('detallesMatrizContenido');

let appsCache = [];
let editCtx = null;
let currentPage = 1;
const PAGE_SIZE = 10;
let rows = [];

// --- Cargar apps ---
async function cargarAppsParaSelector() {
    try {
        appsCache = [];
        appSelect.innerHTML = '<option value="">Seleccionar aplicación...</option>';
        const appsSnap = await getDocs(collection(db, 'apps'));

        for (const appDoc of appsSnap.docs) {
            const aData = appDoc.data();
            const appNombre = aData.nombre || '(Sin nombre)';
            const modSnap = await getDocs(collection(db, `apps/${appDoc.id}/modulos`));
            const modulos = modSnap.docs.map(m => ({ id: m.id, ...(m.data() || {}) }));
            appsCache.push({ appId: appDoc.id, appNombre, modulos });

            if (modulos.length === 0) {
                const opt = document.createElement('option');
                opt.value = `${appDoc.id}|_auto_`;
                opt.textContent = `${appNombre} / (Sin módulo)`;
                appSelect.appendChild(opt);
            } else {
                for (const m of modulos) {
                    const opt = document.createElement('option');
                    opt.value = `${appDoc.id}|${m.id}`;
                    opt.textContent = `${appNombre} / ${m.nombre || '(Sin módulo)'}`;
                    appSelect.appendChild(opt);
                }
            }
        }
    } catch (error) {
        Swal.fire('Error', 'No se pudieron cargar las aplicaciones registradas.', 'error');
    }
}

// --- Cargar matrices ---
async function cargarMatrices(pagina = 1) {
    tablaBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">Cargando matrices...</td></tr>`;
    rows = [];

    const appsSnap = await getDocs(query(collection(db, 'apps'), orderBy('createdAt', 'desc')));
    for (const appDoc of appsSnap.docs) {
        const appName = appDoc.data()?.nombre || '(Sin app)';
        const modSnap = await getDocs(collection(db, `apps/${appDoc.id}/modulos`));

        for (const modDoc of modSnap.docs) {
            const modName = modDoc.data()?.nombre || '(Sin módulo)';
            const matsSnap = await getDocs(collection(db, `apps/${appDoc.id}/modulos/${modDoc.id}/matrices`));

            matsSnap.forEach((matDoc) => {
                const m = matDoc.data() || {};
                rows.push({
                    appId: appDoc.id,
                    moduloId: modDoc.id,
                    matrizId: matDoc.id,
                    appNombre: appName,
                    moduloNombre: modName,
                    ...m
                });
            });
        }
    }

    const start = (pagina - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const paginatedRows = rows.slice(start, end);
    let i = start + 1;

    tablaBody.innerHTML = paginatedRows.map(r => `
    <tr>
      <td>${i++}</td>
      <td>${r.nombre || '-'}</td>
      <td>${r.appNombre}</td>
      <td>${r.moduloNombre}</td>
      <td>${r.descripcion || '-'}</td>
      <td>${r.ambiente || '-'}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-info me-1" data-action="detalles" data-app="${r.appId}" data-modulo="${r.moduloId}" data-id="${r.matrizId}">
          <i class="bi bi-eye"></i>
        </button>
        <button class="btn btn-sm btn-outline-primary me-1" data-action="editar" data-app="${r.appId}" data-modulo="${r.moduloId}" data-id="${r.matrizId}">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" data-action="eliminar" data-app="${r.appId}" data-modulo="${r.moduloId}" data-id="${r.matrizId}">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');

    document.getElementById('paginaActual').textContent = `Página ${pagina}`;
    currentPage = pagina;
}

// --- Guardar o editar ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const sel = appSelect.value;
    if (!sel) return Swal.fire('Atención', 'Selecciona una aplicación/módulo.', 'info');

    let [appId, moduloId] = sel.split('|');
    const payload = {
        nombre: nombreMatriz.value.trim(),
        descripcion: descripcionMatriz.value.trim(),
        ambiente: ambienteMatriz.value.trim(),
        submodulo: submoduloMatriz.value.trim(),
        cicloPruebas: cicloPruebas.value.trim(),
        updatedAt: serverTimestamp()
    };

    try {
        if (editCtx) {
            await updateDoc(doc(db, `apps/${editCtx.appId}/modulos/${editCtx.moduloId}/matrices/${editCtx.matrizId}`), payload);
            Swal.fire('Actualizado', 'La matriz se actualizó correctamente.', 'success');
        } else {
            const ref = await addDoc(collection(db, `apps/${appId}/modulos/${moduloId}/matrices`), {
                ...payload,
                createdAt: serverTimestamp()
            });
            // Crear ciclo de prueba asociado
            if (payload.cicloPruebas) {
                await addDoc(collection(db, `apps/${appId}/modulos/${moduloId}/matrices/${ref.id}/ciclos`), {
                    nombre: payload.cicloPruebas,
                    fechaInicio: serverTimestamp(),
                    activo: true
                });
            }
            Swal.fire('Registrado', 'Matriz creada correctamente.', 'success');
        }
        modal.hide();
        form.reset();
        await cargarMatrices(currentPage);
    } catch (err) {
        Swal.fire('Error', 'No se pudo guardar la matriz.', 'error');
    }
});

// --- Ver detalles ---
tablaBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const { app: appId, modulo: moduloId, id: matrizId } = btn.dataset;

    if (action === 'detalles') {
        const ref = doc(db, `apps/${appId}/modulos/${moduloId}/matrices/${matrizId}`);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const data = snap.data();
        const ciclosSnap = await getDocs(collection(db, `apps/${appId}/modulos/${moduloId}/matrices/${matrizId}/ciclos`));
        let ciclosHtml = '';
        ciclosSnap.forEach(c => {
            const d = c.data();
            ciclosHtml += `<li>${d.nombre || 'Sin nombre'} - ${d.activo ? 'Activo' : 'Inactivo'}</li>`;
        });
        if (!ciclosHtml) ciclosHtml = '<li class="text-muted">Sin ciclos registrados</li>';

        detallesCont.innerHTML = `
      <ul class="list-group list-group-flush">
        <li class="list-group-item"><strong>Nombre:</strong> ${data.nombre}</li>
        <li class="list-group-item"><strong>Descripción:</strong> ${data.descripcion}</li>
        <li class="list-group-item"><strong>Ambiente:</strong> ${data.ambiente}</li>
        <li class="list-group-item"><strong>Submódulo:</strong> ${data.submodulo || '-'}</li>
        <li class="list-group-item"><strong>Ciclo Actual:</strong> ${data.cicloPruebas || '-'}</li>
        <li class="list-group-item"><strong>Ciclos de Pruebas:</strong>
          <ul class="mt-2">${ciclosHtml}</ul>
        </li>
        <li class="list-group-item"><strong>Creado:</strong> ${data.createdAt ? new Date(data.createdAt.toDate()).toLocaleString() : '-'}</li>
        <li class="list-group-item"><strong>Actualizado:</strong> ${data.updatedAt ? new Date(data.updatedAt.toDate()).toLocaleString() : '-'}</li>
      </ul>
    `;
        modalDetalles.show();
    }
});

// --- Inicialización ---
onAuthStateChanged(auth, async (user) => {
    if (!user) return location.href = 'index.html';
    await cargarAppsParaSelector();
    await cargarMatrices();
});
