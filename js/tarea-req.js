// /js/tarea-req.js
import { db, auth } from './firebase-config.js';
import {
    collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
    query, orderBy, onSnapshot, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs';

// ---- DOM ----
const tablaBody = document.querySelector('#tablaTareas tbody');
const btnVolver = document.getElementById('btnVolver');
const btnNuevaTarea = document.getElementById('btnNuevaTarea');
const btnExportarExcel = document.getElementById('btnExportarExcel');
const infoPagina = document.getElementById('infoPagina');

const modalEl = document.getElementById('modalTarea');
const modalTarea = modalEl ? new bootstrap.Modal(modalEl) : null;
const formTarea = document.getElementById('formTarea');

const tId = document.getElementById('tareaId');
const tFolio = document.getElementById('tFolio');
const tTitulo = document.getElementById('tTitulo');
const tDescripcion = document.getElementById('tDescripcion');
const tPrioridad = document.getElementById('tPrioridad');
const tEstado = document.getElementById('tEstado');
const tResponsable = document.getElementById('tResponsable');

const tituloVista = document.getElementById('tituloVista');
const tMatrizActiva = document.getElementById("tMatrizActiva");



// ---- Parámetros URL ----
const params = new URLSearchParams(window.location.search);
let appId = params.get("appId");
let reqId = params.get("reqId");

// Evitar redirección prematura
// Esperar a que el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    appId = params.get('appId');
    reqId = params.get('reqId');

    if (!appId || !reqId) {
        console.warn("⚠️ Parámetros faltantes en la URL:", { appId, reqId });
        // No redirigimos de inmediato, solo notificamos
    }
});


// ---- Estado de tabla / paginación ----
let tareas = [];
let page = 1;
const pageSize = 10;

// ---- Helpers ----
const prioridadBadge = (prio) => {
    const p = (prio || '').toLowerCase();
    if (p === 'alta') return `<span class="badge badge-prio-alta"><i class="bi bi-exclamation-circle me-1 mr-2"></i>Alta</span>`;
    if (p === 'media') return `<span class="badge badge-prio-media"><i class="bi bi-dash-circle me-1 mr-2"></i>Media</span>`;
    return `<span class="badge badge-prio-baja"><i class="bi bi-check-circle me-1"></i>Baja</span>`;
};

const fmtFecha = (ts) => {
    try {
        const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
        if (!d) return '-';
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch { return '-'; }
};

// ---- Cargar header (nombre app y folio req) ----
async function cargarEncabezado() {
    const appSnap = await getDoc(doc(db, 'apps', appId));
    let appName = 'App';
    if (appSnap.exists()) appName = appSnap.data().nombre || 'App';

    const reqSnap = await getDoc(doc(db, `apps/${appId}/requerimientos`, reqId));
    let folioReq = '';
    if (reqSnap.exists()) folioReq = reqSnap.data().folio || '';

    tituloVista.textContent = ` ${folioReq} — ${appName}`;
}

// ---- Cargar testers para el select de responsable ----
async function cargarTesters() {
    tResponsable.innerHTML = '<option value="">Seleccionar tester...</option>';
    const snap = await getDocs(collection(db, 'users'));
    snap.forEach(s => {
        const u = s.data();
        const role = (u.role || '').toLowerCase();
        if (role.includes('tester') || role.includes('qa')) {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = u.name || u.email || s.id;
            tResponsable.appendChild(opt);
        }
    });
}

// ---- Suscripción a tareas (orden: creación desc) ----
let unsub = null;
function suscribirTareas() {
    if (unsub) unsub();
    const ref = collection(db, `apps/${appId}/requerimientos/${reqId}/tareas`);
    const q = query(ref, orderBy('createdAt', 'desc'));
    unsub = onSnapshot(q, (snap) => {
        tareas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        page = 1;
        renderTabla();
    }, (err) => {
        console.error('Error onSnapshot tareas:', err);
    });
}

// ---- Render tabla con paginación ----
function renderTabla() {
    if (!tareas.length) {
        tablaBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No hay tareas registradas.</td></tr>`;
        infoPagina.textContent = `Página 1`;
        return;
    }

    const total = tareas.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (page > totalPages) page = totalPages;

    const start = (page - 1) * pageSize;
    const slice = tareas.slice(start, start + pageSize);

    tablaBody.innerHTML = slice.map((t, idx) => `
    <tr>
        <td>${start + idx + 1}</td>
        <td>${t.folio || '-'}</td>
        <td>${t.titulo || '-'}</td>
        <td>${prioridadBadge(t.prioridad)}</td>
        <td>${t.estado || '-'}</td>
        <td>${t.responsableNombre || '-'}</td>
        <td>${fmtFecha(t.createdAt) || '-'}</td>
        <td class="text-center">
        <div class="form-check form-switch d-inline-flex align-items-center">
        <input class="form-check-input toggle-matriz" type="checkbox" data-id="${t.id}" ${t.matrizActiva ? 'checked' : ''}>
        </div><td class="text-nowrap">
        <button class="btn btn-sm btn-outline-primary me-2" data-action="editar" data-id="${t.id}">
            <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger me-2" data-action="eliminar" data-id="${t.id}">
            <i class="bi bi-trash"></i>
        </button>
        ${t.matrizActiva ? `
        <button class="btn btn-sm btn-outline-success" data-action="verMatriz" data-id="${t.id}">
        <i class="bi bi-diagram-3"></i>
        </button>` : ''}
       </td>
    </tr>
    `).join('');
    infoPagina.textContent = `Página ${page}`;
}

// ---- Paginación ----
document.getElementById('btnPrev')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (page > 1) { page--; renderTabla(); }
});
document.getElementById('btnNext')?.addEventListener('click', (e) => {
    e.preventDefault();
    const totalPages = Math.max(1, Math.ceil(tareas.length / pageSize));
    if (page < totalPages) { page++; renderTabla(); }
});

// ---- Volver ----
btnVolver?.addEventListener('click', () => {
    location.href = `requerimientos.html?appId=${appId}`;
});

// ---- Nueva tarea (limpiar modal) ----
btnNuevaTarea?.addEventListener('click', () => {
    tId.value = '';
    formTarea.reset();
    // Mantener selects con valores por defecto
    tPrioridad.value = 'Alta';
    tEstado.value = 'Pendiente';
});

// ---- Guardar tarea (crear/editar) ----
formTarea.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
        const tFolio = document.getElementById("tFolio");
        const tTitulo = document.getElementById("tTitulo");
        const tDescripcion = document.getElementById("tDescripcion");
        const tPrioridad = document.getElementById("tPrioridad");
        const tEstado = document.getElementById("tEstado");
        const selTester = document.getElementById("tResponsable");
        const tMatrizActiva = document.getElementById("tMatrizActiva");

        // 🧠 Validar que el elemento exista antes de leerlo
        const matrizActivaValue = tMatrizActiva ? tMatrizActiva.checked : false;

        const data = {
            folio: tFolio.value.trim(),
            titulo: tTitulo.value.trim(),
            descripcion: tDescripcion.value.trim(),
            prioridad: tPrioridad.value,
            estado: tEstado.value,
            responsableUid: selTester?.value || '',
            responsableNombre: selTester?.selectedOptions[0]?.textContent || '',
            matrizActiva: matrizActivaValue,
            updatedAt: serverTimestamp()
        };

        // En la función de guardado
        if (tId.value) {
            const ref = doc(db, `apps/${appId}/requerimientos/${reqId}/tareas`, tId.value);
            await updateDoc(ref, data);
        } else {
            data.createdAt = serverTimestamp();
            const ref = collection(db, `apps/${appId}/requerimientos/${reqId}/tareas`);
            await addDoc(ref, data);
        }

        bootstrap.Modal.getInstance(document.getElementById('modalTarea')).hide();
        formTarea.reset();

    } catch (err) {
        console.error("Error guardando tarea:", err);
        Swal.fire('Error', 'No se pudo guardar la tarea. Revisa la consola.', 'error');
    }
});


// ---- Acciones tabla (editar / eliminar) ----
tablaBody?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const refDoc = doc(db, `apps/${appId}/requerimientos/${reqId}/tareas`, id);

    if (action === 'editar') {
        tId.value = id; // Guarda el ID actual para que updateDoc funcione
        const refDoc = doc(db, `apps/${appId}/requerimientos/${reqId}/tareas`, id);
        const snap = await getDoc(refDoc);
        const t = snap.data();

        if (!t) return Swal.fire('Error', 'No se encontró la tarea seleccionada', 'error');

        // 🟢 Espera a que el modal se muestre
        const modalElement = document.getElementById('modalTarea');
        const modal = new bootstrap.Modal(modalElement);
        modal.show();

        // 🕐 Espera a que el DOM del modal esté listo
        modalElement.addEventListener('shown.bs.modal', () => {
            document.getElementById('tFolio').value = t.folio || '';
            document.getElementById('tTitulo').value = t.titulo || '';
            document.getElementById('tDescripcion').value = t.descripcion || '';
            document.getElementById('tPrioridad').value = t.prioridad || 'Media';
            document.getElementById('tEstado').value = t.estado || 'Pendiente';
            document.getElementById('tResponsable').value = t.responsableUid || '';
            document.getElementById('matrizActiva').checked = t.matrizActiva || false;
        }, { once: true });
    }


    if (action === 'eliminar') {
        const conf = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar tarea?',
            text: 'Esta acción no se puede deshacer.',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Eliminar'
        });
        if (!conf.isConfirmed) return;
        await deleteDoc(refDoc);
        Swal.fire('🗑️ Eliminada', 'La tarea fue eliminada.', 'success');
    }
});

// ---- Toggle de Matriz activa ----
tablaBody?.addEventListener('change', async (e) => {
    const input = e.target.closest('.toggle-matriz');
    if (!input) return;

    const id = input.dataset.id;
    const activo = input.checked;
    const refDoc = doc(db, `apps/${appId}/requerimientos/${reqId}/tareas`, id);
    await updateDoc(refDoc, { matrizActiva: activo });

    if (activo) {
        Swal.fire('✅ Activada', 'La matriz ha sido habilitada para esta tarea.', 'success');
    } else {
        Swal.fire('ℹ️ Desactivada', 'La matriz se ha deshabilitado.', 'info');
    }
    suscribirTareas();
});

// ---- Ir a vista de matrices ----
tablaBody?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action="verMatriz"]');
    if (!btn) return;
    const id = btn.dataset.id;
    window.location.href = `matrices.html?appId=${appId}&reqId=${reqId}&tareaId=${id}`;
});


// ---- Exportar Excel ----
btnExportarExcel?.addEventListener('click', async () => {
    try {
        if (!tareas.length) {
            Swal.fire('Sin datos', 'No hay tareas para exportar.', 'info');
            return;
        }

        const data = tareas.map(t => ({
            'Folio': t.folio || '',
            'Título': t.titulo || '',
            'Descripción': t.descripcion || '',
            'Prioridad': t.prioridad || '',
            'Estado': t.estado || '',
            'Responsable': t.responsableNombre || '',
            'Creada': fmtFecha(t.createdAt),
            'Actualizada': fmtFecha(t.updatedAt),
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Tareas');

        // Formato de encabezados y columnas
        const formatHeaderAndColumns = (ws) => {
            const range = XLSX.utils.decode_range(ws['!ref']);

            // Encabezado
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
                if (cell) {
                    cell.s = {
                        fill: { fgColor: { rgb: '4A90E2' } },
                        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 },
                        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
                        border: {
                            top: { style: 'thin', color: { rgb: 'CCCCCC' } },
                            bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
                            left: { style: 'thin', color: { rgb: 'CCCCCC' } },
                            right: { style: 'thin', color: { rgb: 'CCCCCC' } }
                        }
                    };
                }
            }

            // Anchos
            const cols = [];
            for (let C = range.s.c; C <= range.e.c; ++C) {
                let maxLen = 10;
                for (let R = range.s.r; R <= range.e.r; ++R) {
                    const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
                    if (cell && cell.v) maxLen = Math.max(maxLen, cell.v.toString().length);
                }
                cols.push({ wch: Math.min(maxLen + 4, 40) });
            }
            ws['!cols'] = cols;

            // Altura filas
            const rows = [];
            for (let R = range.s.r; R <= range.e.r; ++R) rows.push({ hpt: R === 0 ? 24 : 18 });
            ws['!rows'] = rows;
        };

        formatHeaderAndColumns(ws);
        const fecha = new Date().toLocaleDateString('es-MX').replace(/\//g, '-');
        XLSX.writeFile(wb, `Tareas_Requerimiento_${fecha}.xlsx`);
        Swal.fire('✅ Exportado', 'Se generó el Excel de tareas.', 'success');

    } catch (err) {
        console.error('Error exportando:', err);
        Swal.fire('Error', 'No se pudo generar el archivo.', 'error');
    }
});

// ---- Inicialización ----
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        Swal.fire('Sesión expirada', 'Por favor inicia sesión', 'warning')
            .then(() => location.href = 'index.html');
        return;
    }

    // 🔹 Reasegurar los parámetros si aún están vacíos
    if (!appId || !reqId) {
        const params = new URLSearchParams(window.location.search);
        appId = params.get('appId');
        reqId = params.get('reqId');
    }

    if (!appId || !reqId) {
        Swal.fire("⚠️ Faltan datos", "No se detectaron los identificadores del requerimiento.", "warning")
            .then(() => window.location.href = "requerimientos.html");
        return;
    }

    console.log("✅ Parámetros cargados correctamente:", { appId, reqId });

    // Ahora sí, continúa con la carga de datos:
    await cargarEncabezado(appId, reqId);
    await cargarTesters();
    suscribirTareas(appId, reqId);
});