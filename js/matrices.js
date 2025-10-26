// /js/matrices.js
import { db, auth } from './firebase-config.js';
import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    setDoc,
    query,
    orderBy,
    limit,
    startAfter,
    serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';

// --- Referencias DOM ---
const tablaBody = document.querySelector('#tablaMatrices tbody');
const btnRecargar = document.getElementById('btnRecargarMatrices');
const form = document.getElementById('formMatriz');
const modalEl = document.getElementById('modalMatriz');
const modal = modalEl ? new bootstrap.Modal(modalEl) : null;
const appSelect = document.getElementById('appRelacionada');

let appsCache = [];
let editCtx = null;

// --- Configuración de paginación ---
const PAGE_SIZE = 10;
let currentPage = 1;
let rows = [];

// --- 🔹 Verificación de sesión ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        await Swal.fire({
            icon: 'warning',
            title: 'Sesión expirada',
            text: 'Por favor, inicia sesión nuevamente.',
            confirmButtonColor: '#23223F'
        });
        window.location.href = 'index.html';
        return;
    }
    await cargarAppsParaSelector();
    await cargarMatrices();
});

// --- 🔹 Cargar Apps y módulos para el selector ---
async function cargarAppsParaSelector() {
    try {
        appsCache = [];
        appSelect.innerHTML = '<option value="">Seleccionar aplicación...</option>';

        const appsSnap = await getDocs(collection(db, 'apps'));
        if (appsSnap.empty) {
            appSelect.innerHTML = '<option value="">No hay aplicaciones registradas</option>';
            return;
        }

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
        console.error('❌ Error al cargar apps para selector:', error);
        Swal.fire('Error', 'No se pudieron cargar las aplicaciones registradas.', 'error');
    }
}

// --- 🔹 Cargar matrices con paginación ---
async function cargarMatrices(pagina = 1) {
    tablaBody.innerHTML = `
    <tr><td colspan="7" class="text-center text-muted py-4">Cargando matrices...</td></tr>
  `;

    try {
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
                        nombre: m.nombre || '(Sin nombre)',
                        descripcion: m.descripcion || '',
                        ambiente: m.ambiente || '',
                    });
                });
            }
        }

        if (!rows.length) {
            tablaBody.innerHTML = `
        <tr><td colspan="7" class="text-center text-muted py-4">No hay matrices registradas.</td></tr>
      `;
            return;
        }

        // --- Paginación ---
        const start = (pagina - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const paginatedRows = rows.slice(start, end);

        // Render
        let i = start + 1;
        tablaBody.innerHTML = paginatedRows.map(r => `
      <tr>
        <td>${i++}</td>
        <td>${r.nombre}</td>
        <td>${r.appNombre}</td>
        <td>${r.moduloNombre}</td>
        <td>${r.descripcion}</td>
        <td>${r.ambiente}</td>
        <td class="text-center">
          <a class="btn btn-sm btn-outline-info me-2"
             href="casos.html?id=${r.matrizId}&app=${r.appId}&modulo=${r.moduloId}">
            <i class="bi bi-list-check"></i> Casos
          </a>
          <button class="btn btn-sm btn-outline-primary me-2"
                  data-action="editar"
                  data-app="${r.appId}"
                  data-modulo="${r.moduloId}"
                  data-id="${r.matrizId}">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger"
                  data-action="eliminar"
                  data-app="${r.appId}"
                  data-modulo="${r.moduloId}"
                  data-id="${r.matrizId}">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');

        document.getElementById('paginaActual').textContent = `Página ${pagina}`;
        currentPage = pagina;
    } catch (error) {
        console.error('❌ Error al cargar matrices:', error);
        Swal.fire('Error', 'No se pudieron cargar las matrices.', 'error');
    }
}

// --- 🔁 Recargar manual ---
btnRecargar?.addEventListener('click', () => cargarMatrices(1));

// --- 🧩 Guardar / Editar matriz ---
form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const sel = appSelect.value;
    if (!sel) {
        Swal.fire('Atención', 'Selecciona una aplicación/módulo.', 'info');
        return;
    }

    let [appId, moduloId] = sel.split('|');

    const payload = {
        nombre: document.getElementById('nombreMatriz').value.trim(),
        descripcion: document.getElementById('descripcionMatriz').value.trim(),
        ambiente: document.getElementById('ambienteMatriz').value.trim(),
        submodulo: document.getElementById('submoduloMatriz').value.trim(),
        updatedAt: serverTimestamp(),
    };

    try {
        if (moduloId === '_auto_') {
            const appSnap = await getDoc(doc(db, `apps/${appId}`));
            const appData = appSnap.exists() ? appSnap.data() : {};
            const appNombre = appData.nombre || 'Aplicación';

            const nuevoModuloRef = doc(collection(db, `apps/${appId}/modulos`));
            await setDoc(nuevoModuloRef, {
                nombre: `Módulo de ${appNombre} - General`,
                ambiente: 'Desarrollo',
                submodulo: 'Base',
                fechaInicio: serverTimestamp(),
                creadoAutomaticamente: true,
            });
            moduloId = nuevoModuloRef.id;
            console.log(`🧱 Módulo automático creado: ${moduloId}`);
        }

        if (editCtx) {
            await updateDoc(
                doc(db, `apps/${editCtx.appId}/modulos/${editCtx.moduloId}/matrices/${editCtx.matrizId}`),
                payload
            );
            Swal.fire('Actualizado', 'La matriz se actualizó correctamente.', 'success');
        } else {
            await addDoc(collection(db, `apps/${appId}/modulos/${moduloId}/matrices`), {
                ...payload,
                createdAt: serverTimestamp(),
            });
            Swal.fire('Registrado', 'La matriz se agregó correctamente.', 'success');
        }

        form.reset();
        editCtx = null;
        modal?.hide();
        await cargarMatrices(currentPage);
    } catch (err) {
        console.error('❌ Error guardando matriz:', err);
        Swal.fire('Error', 'No se pudo guardar la matriz.', 'error');
    }
});

// --- Limpiar modal ---
modalEl?.addEventListener('hidden.bs.modal', () => {
    form?.reset();
    editCtx = null;
    document.getElementById('modalMatrizLabel').textContent = 'Registrar Matriz';
});

// --- Delegación de acciones ---
tablaBody?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const action = btn.dataset.action;
    const appId = btn.dataset.app;
    const moduloId = btn.dataset.modulo;
    const matrizId = btn.dataset.id;

    if (action === 'eliminar') {
        const c = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar matriz?',
            text: 'Se eliminará la matriz (no elimina casos/bugs anidados).',
            showCancelButton: true,
            confirmButtonText: 'Eliminar',
            cancelButtonText: 'Cancelar',
        });
        if (!c.isConfirmed) return;

        try {
            await deleteDoc(doc(db, `apps/${appId}/modulos/${moduloId}/matrices/${matrizId}`));
            Swal.fire('Eliminado', 'La matriz fue eliminada.', 'success');
            await cargarMatrices(currentPage);
        } catch (err) {
            console.error('❌ Error eliminando matriz:', err);
            Swal.fire('Error', 'No se pudo eliminar la matriz.', 'error');
        }
    }

    if (action === 'editar') {
        try {
            const ref = doc(db, `apps/${appId}/modulos/${moduloId}/matrices/${matrizId}`);
            const snap = await getDoc(ref);
            if (!snap.exists()) {
                Swal.fire('Error', 'No se encontró la matriz.', 'error');
                return;
            }
            const data = snap.data() || {};

            document.getElementById('nombreMatriz').value = data.nombre || '';
            document.getElementById('descripcionMatriz').value = data.descripcion || '';
            document.getElementById('ambienteMatriz').value = data.ambiente || '';
            document.getElementById('submoduloMatriz').value = data.submodulo || '';

            const val = `${appId}|${moduloId}`;
            if ([...appSelect.options].some(o => o.value === val)) {
                appSelect.value = val;
            }

            editCtx = { appId, moduloId, matrizId };
            document.getElementById('modalMatrizLabel').textContent = 'Editar Matriz';
            modal?.show();
        } catch (err) {
            console.error('❌ Error cargando matriz:', err);
            Swal.fire('Error', 'No se pudo cargar la matriz.', 'error');
        }
    }
});

// --- Paginación ---
document.getElementById('nextPage')?.addEventListener('click', () => {
    if ((currentPage * PAGE_SIZE) < rows.length) {
        cargarMatrices(currentPage + 1);
    }
});

document.getElementById('prevPage')?.addEventListener('click', () => {
    if (currentPage > 1) cargarMatrices(currentPage - 1);
});
