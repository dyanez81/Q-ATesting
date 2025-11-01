// /js/casos.js
import { db, storage, auth } from './firebase-config.js';
import {
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import {
    ref,
    uploadBytes,
    getDownloadURL,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs";

// --- Parámetros URL ---
const params = new URLSearchParams(window.location.search);
const appId = params.get('app');
const moduloId = params.get('modulo');
const matrizId = params.get('id');

// 🔹 Referencia del botón
const btnExportarExcel = document.getElementById('btnExportarExcel');

if (!appId || !moduloId || !matrizId) {
    Swal.fire('Error', 'No se ha especificado correctamente la matriz.', 'error')
        .then(() => (window.location.href = 'matrices.html'));
    throw new Error('Faltan parámetros en la URL');
}

// --- Referencias DOM ---
const tabla = document.querySelector('#tablaCasos tbody');
const form = document.getElementById('formCaso');
const modalEl = document.getElementById('modalCaso');
const modal = modalEl ? new bootstrap.Modal(modalEl) : null;
const evidenciaInput = document.getElementById('evidenciaCaso');
const matrizTitleEl = document.getElementById('nombreMatriz');
const backBtn = document.getElementById('btnVolver');
const btnRecargar = document.getElementById('btnRecargarCasos');

// --- Modal Bug ---
const modalBugEl = document.getElementById('modalBug');
const modalBug = modalBugEl ? new bootstrap.Modal(modalBugEl) : null;
const formBug = document.getElementById('formBug');
const bugCasoNombre = document.getElementById('bugCasoNombre');
const bugNombre = document.getElementById('bugNombre');
const bugDescripcion = document.getElementById('bugDescripcion');
const bugEvidencia = document.getElementById('bugEvidencia');

// --- Variables ---
let editandoId = null;
let casoActual = null;
const casosPathBase = `apps/${appId}/modulos/${moduloId}/matrices/${matrizId}/casos`;

// --- Configuración de paginación ---
const PAGE_SIZE = 10;
let currentPage = 1;
let casosCache = [];

// --- 🧩 Pintar título de la matriz ---
async function pintarTituloMatriz() {
    try {
        const matrizRef = doc(db, `apps/${appId}/modulos/${moduloId}/matrices/${matrizId}`);
        const snap = await getDoc(matrizRef);
        if (snap.exists()) {
            const data = snap.data();
            matrizTitleEl.textContent = data.nombre || 'Matriz de Casos';
        }
    } catch (e) {
        console.error('Error obteniendo título de la matriz:', e);
    }
}

// --- 🔙 Botón Volver ---
backBtn?.addEventListener('click', () => {
    window.location.href = `matrices.html`;
});

// --- 🔁 Recargar manual ---
btnRecargar?.addEventListener('click', () => cargarCasos(1));

// --- Cargar casos con paginación ---
async function cargarCasos(pagina = 1) {
    tabla.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">Cargando casos...</td></tr>`;
    try {
        const casosSnap = await getDocs(collection(db, casosPathBase));
        if (casosSnap.empty) {
            tabla.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No hay casos registrados.</td></tr>`;
            return;
        }

        // Obtener bugs vinculados a esta matriz
        const bugsQuery = query(collection(db, 'bugs'), where('datos.matrizId', '==', matrizId));
        const bugsSnap = await getDocs(bugsQuery);

        const casosConBugs = new Set();
        bugsSnap.forEach((bug) => {
            const bugData = bug.data();
            if (bugData.datos?.casoId) casosConBugs.add(bugData.datos.casoId);
        });

        casosCache = casosSnap.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                ...data,
                tieneBug: casosConBugs.has(docSnap.id),
            };
        });

        renderCasos(pagina);
    } catch (error) {
        console.error('Error al cargar casos:', error);
        Swal.fire('Error', 'No se pudieron cargar los casos.', 'error');
    }
}

// --- Render paginado ---
function renderCasos(pagina) {
    const start = (pagina - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageData = casosCache.slice(start, end);
    currentPage = pagina;

    if (!pageData.length) {
        tabla.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No hay casos en esta página.</td></tr>`;
        return;
    }

    let html = '';
    let i = start + 1;

    pageData.forEach((c) => {
        const iconoBug = c.tieneBug
            ? `<i class="bi bi-bug-fill text-danger ms-1" title="Este caso tiene bugs"></i>`
            : '';

        let estadoClass = 'secondary';
        if (c.Estado === 'Positivo') estadoClass = 'success';
        else if (c.Estado === 'Pendiente') estadoClass = 'warning';
        else if (c.Estado === 'Fallo') estadoClass = 'danger';
        else if (c.Estado === 'Bloqueado') estadoClass = 'dark';

        html += `
      <tr>
        <td>${i++}</td>
        <td>${c.NombreDelCaso || '-'} ${iconoBug}</td>
        <td>${c.TipoDePrueba || '-'}</td>
        <td><span class="badge bg-${estadoClass}">${c.Estado || '-'}</span></td>
        <td>${c.Tester || '-'}</td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-primary me-2" data-id="${c.id}" data-action="editar" title="Editar caso">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger me-2" data-id="${c.id}" data-action="eliminar" title="Eliminar caso">
            <i class="bi bi-trash"></i>
          </button>
          <button class="btn btn-sm btn-outline-warning" data-id="${c.id}" data-action="bug" title="Reportar bug">
            <i class="bi bi-bug"></i>
          </button>
        </td>
      </tr>`;
    });

    tabla.innerHTML = html;
    document.getElementById('paginaActual').textContent = `Página ${pagina}`;
}

// --- Paginación botones ---
document.getElementById('nextPage')?.addEventListener('click', () => {
    if ((currentPage * PAGE_SIZE) < casosCache.length) renderCasos(currentPage + 1);
});
document.getElementById('prevPage')?.addEventListener('click', () => {
    if (currentPage > 1) renderCasos(currentPage - 1);
});

// --- CRUD CASOS ---
form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const caso = {
        NombreDelCaso: document.getElementById('nombreCaso').value.trim(),
        Descripcion: document.getElementById('descripcionCaso').value.trim(),
        Precondiciones: document.getElementById('precondicionesCaso').value.trim(),
        Pasos: document.getElementById('pasosCaso').value.trim(),
        TipoDePrueba: document.getElementById('tipoPruebaCaso').value.trim(),
        ResultadoEsperado: document.getElementById('resultadoEsperadoCaso').value.trim(),
        Estado: document.getElementById('estadoCaso').value,
        Tester: auth.currentUser?.email || 'tester@finsus.mx',
        Fecha: serverTimestamp(),
        FechaEjecucion: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    try {
        if (evidenciaInput?.files?.length > 0) {
            const file = evidenciaInput.files[0];
            const fileRef = ref(storage, `evidencias/${Date.now()}_${file.name}`);
            await uploadBytes(fileRef, file);
            caso.EvidenciaNombre = file.name;
            caso.EvidenciaUrl = await getDownloadURL(fileRef);
        }

        if (editandoId) {
            await updateDoc(doc(db, `${casosPathBase}/${editandoId}`), caso);
            Swal.fire('Actualizado', 'El caso fue actualizado correctamente.', 'success');
        } else {
            caso.createdAt = serverTimestamp();
            await addDoc(collection(db, casosPathBase), caso);
            Swal.fire('Registrado', 'El caso fue registrado correctamente.', 'success');
        }

        form.reset();
        editandoId = null;
        modal?.hide();
        cargarCasos(currentPage);
    } catch (err) {
        console.error('Error al guardar caso:', err);
        Swal.fire('Error', 'No se pudo guardar el caso.', 'error');
    }
});

// --- Eventos de tabla ---
tabla?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'editar') {
        const refCaso = doc(db, `${casosPathBase}/${id}`);
        const snap = await getDoc(refCaso);
        if (!snap.exists()) return Swal.fire('Error', 'Caso no encontrado.', 'error');
        const data = snap.data();

        editandoId = id;
        document.getElementById('nombreCaso').value = data.NombreDelCaso || '';
        document.getElementById('tipoPruebaCaso').value = data.TipoDePrueba || '';
        document.getElementById('descripcionCaso').value = data.Descripcion || '';
        document.getElementById('precondicionesCaso').value = data.Precondiciones || '';
        document.getElementById('pasosCaso').value = data.Pasos || '';
        document.getElementById('resultadoEsperadoCaso').value = data.ResultadoEsperado || '';
        document.getElementById('estadoCaso').value = data.Estado || 'Pendiente';
        modal?.show();
    }

    if (action === 'eliminar') {
        const confirm = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar caso?',
            text: 'Esta acción no se puede deshacer.',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
        });
        if (!confirm.isConfirmed) return;
        await deleteDoc(doc(db, `${casosPathBase}/${id}`));
        Swal.fire('Eliminado', 'El caso fue eliminado correctamente.', 'success');
        cargarCasos(currentPage);
    }

    if (action === 'bug') {
        casoActual = id;
        const refCaso = doc(db, `${casosPathBase}/${id}`);
        const snap = await getDoc(refCaso);
        if (!snap.exists()) return;
        const data = snap.data();

        bugCasoNombre.value = data.NombreDelCaso || 'Caso sin nombre';
        bugNombre.value = '';
        bugDescripcion.value = '';
        bugEvidencia.value = '';
        modalBug?.show();
    }
});

// --- Guardar Bug ---
formBug?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        let evidenciaUrl = '';
        if (bugEvidencia?.files?.length > 0) {
            const file = bugEvidencia.files[0];
            const fileRef = ref(storage, `bugs/${Date.now()}_${file.name}`);
            await uploadBytes(fileRef, file);
            evidenciaUrl = await getDownloadURL(fileRef);
        }

        const bug = {
            nombre: bugNombre.value.trim(),
            descripcion: bugDescripcion.value.trim(),
            estado: 'Abierto',
            fechaReporte: serverTimestamp(),
            tester: auth.currentUser?.email || 'anon',
            evidenciaUrl,
            datos: {
                appId,
                moduloId,
                matrizId,
                casoId: casoActual,
                casoNombre: bugCasoNombre.value,
            },
            solucion: {},
        };

        await addDoc(collection(db, 'bugs'), bug);
        Swal.fire('Reportado', 'El bug fue registrado correctamente.', 'success');
        modalBug?.hide();
        cargarCasos(currentPage);
    } catch (error) {
        console.error('❌ Error registrando bug:', error);
        Swal.fire('Error', 'No se pudo registrar el bug.', 'error');
    }
});

// --- Inicialización ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        Swal.fire({
            icon: 'warning',
            title: 'Sesión expirada',
            text: 'Por favor, inicia sesión nuevamente.',
            confirmButtonColor: '#23223F',
        }).then(() => (window.location.href = 'index.html'));
    } else {
        pintarTituloMatriz();
        cargarCasos();
    }
});

// Exportacion a excel


btnExportarExcel?.addEventListener('click', async () => {
    try {
        btnExportarExcel.disabled = true;
        btnExportarExcel.innerHTML =
            '<i class="bi bi-hourglass-split"></i> Exportando...';

        // ==============================
        // 🧭 Obtener IDs del contexto
        // ==============================
        let appId = sessionStorage.getItem("appId");
        let moduloId = sessionStorage.getItem("moduloId");
        let matrizId = sessionStorage.getItem("matrizIdActual");

        // 🔍 Si faltan, intentar obtener desde URL o dataset
        const urlParams = new URLSearchParams(window.location.search);
        if (!appId) appId = urlParams.get("appId");
        if (!moduloId) moduloId = urlParams.get("moduloId");
        if (!matrizId) matrizId = urlParams.get("matrizId");

        // ==============================
        // 🧾 Depuración
        // ==============================
        console.group("🧩 Exportar Excel QA Finsus - Diagnóstico");
        console.log("App ID:", appId);
        console.log("Módulo ID:", moduloId);
        console.log("Matriz ID:", matrizId);
        console.log("SessionStorage:", {
            appId: sessionStorage.getItem("appId"),
            moduloId: sessionStorage.getItem("moduloId"),
            matrizIdActual: sessionStorage.getItem("matrizIdActual"),
        });
        console.groupEnd();

        // ==============================
        // ⚠️ Validación
        // ==============================
        const missing = [];
        if (!appId) missing.push("appId");
        if (!moduloId) missing.push("moduloId");
        if (!matrizId) missing.push("matrizIdActual");

        if (missing.length > 0) {
            Swal.fire({
                icon: "warning",
                title: "⚠️ Faltan datos para exportar",
                html: `
        <p>No se pudieron obtener los siguientes identificadores:</p>
        <ul>${missing.map((x) => `<li><b>${x}</b></li>`).join("")}</ul>
        <p>Verifica que la matriz esté correctamente seleccionada o abierta.</p>
      `,
            });
            btnExportarExcel.innerHTML =
                '<i class="bi bi-file-earmark-excel"></i> Exportar a Excel';
            btnExportarExcel.disabled = false;
            return;
        }

        // ==============================
        // 🔗 Confirmar ruta Firestore
        // ==============================
        const matrizPath = `apps/${appId}/modulos/${moduloId}/matrices/${matrizId}`;
        console.log("📂 Ruta Firestore detectada:", matrizPath);

        const matrizRef = doc(db, matrizPath);
        const matrizSnap = await getDoc(matrizRef);

        if (!matrizSnap.exists()) {
            Swal.fire("❌ Error", "No se encontró la matriz seleccionada.", "error");
            return;
        }

        const matrizData = matrizSnap.data();
        const dataCasos = [];
        const dataBugs = [];

        // ==============================
        // 📦 Obtener casos
        // ==============================
        const casosRef = collection(db, `${matrizPath}/casos`);
        const casosSnap = await getDocs(casosRef);

        console.log("📊 Casos encontrados:", casosSnap.size);

        if (casosSnap.empty) {
            Swal.fire("📭 Sin casos", "No hay casos registrados en esta matriz.", "info");
            return;
        }

        // Procesar casos
        for (const casoDoc of casosSnap.docs) {
            const caso = casoDoc.data();
            dataCasos.push({
                "ID Caso": casoDoc.id,
                "Matriz": matrizData.titulo || matrizId,
                "Título": caso.titulo || "",
                "Descripción": caso.descripcion || "",
                "Estado": caso.estado || "",
                "Prioridad": caso.prioridad || "",
                "Tipo": caso.tipo || "",
                "Responsable": caso.asignadoA || "",
                "Fecha Creación": caso.fecha?.toDate
                    ? caso.fecha.toDate().toLocaleString()
                    : "",
                "Última Actualización": caso.updatedAt?.toDate
                    ? caso.updatedAt.toDate().toLocaleString()
                    : "",
            });

            // 📋 Obtener bugs
            const bugsRef = collection(db, `${matrizPath}/casos/${casoDoc.id}/bugs`);
            const bugsSnap = await getDocs(bugsRef);
            console.log(`🐞 Bugs para caso ${casoDoc.id}:`, bugsSnap.size);

            for (const bugDoc of bugsSnap.docs) {
                const bug = bugDoc.data();
                dataBugs.push({
                    "Matriz": matrizData.titulo || matrizId,
                    "Caso": caso.titulo || casoDoc.id,
                    "Bug ID": bugDoc.id,
                    "Título": bug.titulo || "",
                    "Descripción": bug.descripcion || "",
                    "Severidad": bug.severidad || "",
                    "Estatus": bug.estatus || "",
                    "Reportado Por": bug.reportadoPor || "",
                    "Asignado A": bug.asignadoA || "",
                    "Fecha Reporte": bug.fecha?.toDate
                        ? bug.fecha.toDate().toLocaleString()
                        : "",
                    "Última Actualización": bug.updatedAt?.toDate
                        ? bug.updatedAt.toDate().toLocaleString()
                        : "",
                });
            }
        }

        // ==============================
        // 📊 Crear y formatear Excel
        // ==============================
        const wsCasos = XLSX.utils.json_to_sheet(dataCasos);
        const wsBugs = XLSX.utils.json_to_sheet(dataBugs);

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsCasos, "Casos QA");
        XLSX.utils.book_append_sheet(wb, wsBugs, "Bugs QA");

        const formatHeaderAndColumns = (ws) => {
            const range = XLSX.utils.decode_range(ws["!ref"]);
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
                if (cell) {
                    cell.s = {
                        fill: { fgColor: { rgb: "DDEBF7" } },
                        font: { bold: true, color: { rgb: "003366" }, sz: 12 },
                        alignment: { horizontal: "center", vertical: "center", wrapText: true },
                        border: {
                            top: { style: "thin", color: { rgb: "BBBBBB" } },
                            bottom: { style: "thin", color: { rgb: "BBBBBB" } },
                            left: { style: "thin", color: { rgb: "BBBBBB" } },
                            right: { style: "thin", color: { rgb: "BBBBBB" } },
                        },
                    };
                }
            }
            ws["!cols"] = Array(range.e.c + 1).fill({ wch: 25 });
        };

        formatHeaderAndColumns(wsCasos);
        formatHeaderAndColumns(wsBugs);

        const fecha = new Date().toLocaleDateString("es-MX").replace(/\//g, "-");
        XLSX.writeFile(wb, `Casos_y_Bugs_QA_${fecha}.xlsx`);

        Swal.fire("✅ Exportado", "Archivo Excel generado correctamente.", "success");

    } catch (error) {
        console.error("❌ Error al exportar:", error);
        Swal.fire("Error", "No se pudo generar el archivo Excel.", "error");
    } finally {
        btnExportarExcel.innerHTML =
            '<i class="bi bi-file-earmark-excel"></i> Exportar a Excel';
        btnExportarExcel.disabled = false;
    }
});