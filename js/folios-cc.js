// /js/folios-cc.js
import { db, auth } from "./firebase-config.js";
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    getDocs,
    getDocsFromServer
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs";// ✅ Correcto
// ✅ Importación correcta y registro de componentes Chart.js
import {
    Chart,
    BarController,
    BarElement,
    CategoryScale,
    LinearScale,
    Title,
    Tooltip,
    Legend
} from "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/+esm";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend);



// --- Parámetros y referencias
const params = new URLSearchParams(location.search);
const ccId = params.get('id');
if (!ccId) Swal.fire('Falta ID', 'No se proporcionó el id del CC.', 'error').then(() => location.href = '/cc.html');

const resumenCC = document.getElementById('resumenCC');
const tabla = document.getElementById('tablaFolios');
const buscarFolio = document.getElementById('buscarFolio');
const paginacionEl = document.getElementById('paginacion');
const infoPaginacionEl = document.getElementById('infoPaginacion');
const formFolio = document.getElementById('formFolio');
const modalEl = document.getElementById('modalFolio');
const modalFolio = modalEl ? new bootstrap.Modal(modalEl) : null;

// --- Dashboard y gráficas ---
const foliosPendientesEl = document.getElementById("foliosPendientes");
const foliosCerradosEl = document.getElementById("foliosCerrados");
const foliosRiesgoAltoEl = document.getElementById("foliosRiesgoAlto");
let chartRiesgo, chartEstatus;

// --- Estado de tabla ---
let foliosRows = [];
let page = 1;
const pageSize = 10;
let filtro = "";

// --- Render tabla con paginación ---
function aplicarFiltroPaginacion() {
    const data = foliosRows.filter(r =>
        (r.folioCC || '').toLowerCase().includes(filtro) ||
        (r.folio || '').toLowerCase().includes(filtro) ||
        (r.tipo || '').toLowerCase().includes(filtro) ||
        (r.estatus || '').toLowerCase().includes(filtro)
    );
    const total = data.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (page > totalPages) page = totalPages;
    const start = (page - 1) * pageSize;
    const slice = data.slice(start, start + pageSize);

    tabla.innerHTML = slice.map((r, idx) => `
    <tr>
      <td>${start + idx + 1}</td>
      <td>${r.folioCC || '-'}</td>
      <td>${r.folio || '-'}</td>
      <td>${r.revision || '-'}</td>
      <td>${r.celulaTI || '-'}</td>
      <td>${r.tipo || '-'}</td>
      <td><span class="badge bg-${r.estatus === 'Cerrado' ? 'success' : (r.estatus === 'En Revisión' ? 'warning' : 'secondary')}">${r.estatus || '-'}</span></td>
      <td>${r.categoriaCambio || '-'}</td>
      <td><span class="badge bg-${r.riesgo === 'Alto' ? 'danger' : (r.riesgo === 'Medio' ? 'warning' : 'success')}">${r.riesgo || '-'}</span></td>
      <td>${r.impacto || '-'}</td>
      <td class="text-nowrap">
        <button class="btn btn-sm btn-outline-primary" data-id="${r.id}" data-action="edit"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger" data-id="${r.id}" data-action="del"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join('');

    infoPaginacionEl.textContent = `${total === 0 ? 0 : start + 1}-${Math.min(start + pageSize, total)} de ${total}`;
    paginacionEl.innerHTML = '';

    const liPrev = document.createElement('li');
    liPrev.className = `page-item ${page === 1 ? 'disabled' : ''}`;
    liPrev.innerHTML = `<a class="page-link" href="#">«</a>`;
    liPrev.onclick = (e) => { e.preventDefault(); if (page > 1) { page--; aplicarFiltroPaginacion(); } };
    paginacionEl.appendChild(liPrev);

    const totalPagesShow = Math.min(7, Math.max(1, Math.ceil(total / pageSize)));
    const startPage = Math.max(1, Math.min(page - 3, (Math.ceil(total / pageSize) - totalPagesShow) + 1));
    for (let p = startPage; p < startPage + totalPagesShow; p++) {
        const li = document.createElement('li');
        li.className = `page-item ${p === page ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#">${p}</a>`;
        li.onclick = (e) => { e.preventDefault(); page = p; aplicarFiltroPaginacion(); };
        paginacionEl.appendChild(li);
    }
    const liNext = document.createElement('li');
    const maxPages = Math.max(1, Math.ceil(total / pageSize));
    liNext.className = `page-item ${page === maxPages ? 'disabled' : ''}`;
    liNext.innerHTML = `<a class="page-link" href="#">»</a>`;
    liNext.onclick = (e) => { e.preventDefault(); if (page < maxPages) { page++; aplicarFiltroPaginacion(); } };
    paginacionEl.appendChild(liNext);
}

// --- Cargar resumen del CC ---
async function cargarCC() {
    const ccRef = doc(db, 'nuevoCC', ccId);
    const snap = await getDoc(ccRef);
    if (!snap.exists()) {
        if (resumenCC) resumenCC.textContent = 'No existe el CC';
        return;
    }
    const d = snap.data();
    const fmt = (v) => {
        try {
            const dt = (v?.toDate) ? v.toDate() : (v ? new Date(v) : null);
            if (!dt) return '';
            return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
        } catch { return ''; }
    };

    if (resumenCC) {
        resumenCC.innerHTML = `
      <div class="row g-2">
        <div class="col-md-3"><strong>Solicitante:</strong> ${d.solicitante || '-'}</div>
        <div class="col-md-3"><strong>UID:</strong> ${d.uid || '-'}</div>
        <div class="col-md-3"><strong>Fecha creación:</strong> ${fmt(d.fecha)}</div>
        <div class="col-md-3"><strong>Fecha cambio:</strong> ${fmt(d.fechaCambio)}</div>
        <div class="col-md-3"><strong>Revisión:</strong> ${d.revision || '-'}</div>
        <div class="col-md-3"><strong>Célula TI:</strong> ${d.celulaTI || '-'}</div>
        <div class="col-md-3"><strong>Tipo:</strong> ${d.tipo || '-'}</div>
        <div class="col-md-3"><strong>Estatus CC:</strong> ${d.estatusCC || '-'}</div>
        <div class="col-md-3"><strong>Folio CC:</strong> ${d.folioCC || '-'}</div>
      </div>`;
    }
}

// Función para inicializar las gráficas
function inicializarGraficas() {
    const ctxRiesgo = document.getElementById("graficaRiesgo")?.getContext("2d");
    const ctxEstatus = document.getElementById("graficaEstatus")?.getContext("2d");
    if (!ctxRiesgo || !ctxEstatus) return;

    chartRiesgo = new Chart(ctxRiesgo, {
        type: "bar",
        data: {
            labels: ["Alto", "Medio", "Bajo"],
            datasets: [{ label: "Riesgo", data: [0, 0, 0], backgroundColor: ["#dc3545", "#ffc107", "#198754"] }],
        },
        options: { responsive: true, plugins: { legend: { display: false } } },
    });

    chartEstatus = new Chart(ctxEstatus, {
        type: "bar",
        data: {
            labels: ["Pendiente", "En Revisión", "Cerrado"],
            datasets: [{ label: "Estatus", data: [0, 0, 0], backgroundColor: ["#6c757d", "#ffc107", "#198754"] }],
        },
        options: { responsive: true, plugins: { legend: { display: false } } },
    });
}

// Función para actualizar las gráficas con los folios cargados
function actualizarGraficas() {
    if (!chartRiesgo || !chartEstatus) return;

    let alto = 0, medio = 0, bajo = 0;
    let pendiente = 0, revision = 0, cerrado = 0;

    foliosRows.forEach(f => {
        if (f.riesgo === "Alto") alto++;
        else if (f.riesgo === "Medio") medio++;
        else if (f.riesgo === "Bajo") bajo++;

        if (f.estatus === "Pendiente") pendiente++;
        else if (f.estatus === "En Revisión") revision++;
        else if (f.estatus === "Cerrado") cerrado++;
    });

    // 🔹 Actualiza gráficas
    chartRiesgo.data.datasets[0].data = [alto, medio, bajo];
    chartEstatus.data.datasets[0].data = [pendiente, revision, cerrado];
    chartRiesgo.update();
    chartEstatus.update();

    // 🔹 Actualiza dashboard
    const ccPendientesEl = document.getElementById("ccPendientes");
    const ccCerradosEl = document.getElementById("ccCerrados");
    const ccRiesgoAltoEl = document.getElementById("ccRiesgoAlto");

    if (ccPendientesEl) ccPendientesEl.textContent = pendiente;
    if (ccCerradosEl) ccCerradosEl.textContent = cerrado;
    if (ccRiesgoAltoEl) ccRiesgoAltoEl.textContent = alto;
}


// --- Cargar folios del CC (sin tiempo real) ---
// --- Cargar folios del CC (SIN tiempo real y SIN caché) ---
async function cargarFolios() {
    try {
        const ref = collection(db, "nuevoCC", ccId, "folios");
        // 🔒 leer directo del servidor para evitar desfasajes
        const snapshot = await getDocsFromServer(ref);

        foliosRows = [];
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            foliosRows.push({ id: docSnap.id, ...data });
        });

        aplicarFiltroPaginacion();
        actualizarGraficas();
    } catch (error) {
        console.error("❌ Error al cargar folios:", error);
    }
}

// --- Agregar / Editar Folio ---
// 🔧 Guardar folio: SIEMPRE sincroniza folioCC con el padre
formFolio?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const user = auth.currentUser;
        if (!user) {
            Swal.fire('Sesión expirada', 'Inicia sesión nuevamente.', 'warning');
            return;
        }

        // 1) Obtener folioCC del documento padre (no del formulario)
        const ccRef = doc(db, 'nuevoCC', ccId);
        const ccSnap = await getDoc(ccRef);
        const folioCCPadre = ccSnap.exists() ? (ccSnap.data().folioCC || "") : "";

        // 2) Construir payload
        const data = {
            folioCC: folioCCPadre, // ← clave: forzar folioCC del padre
            revision: document.getElementById('fRevision').value.trim(),
            celulaTI: document.getElementById('fCelula').value.trim(),
            estatus: document.getElementById('fEstatus').value.trim(),
            tipo: document.getElementById('fTipo').value.trim(),
            folio: document.getElementById('fFolio').value.trim(),
            descripcion: document.getElementById('fDescripcion').value.trim(),
            comentarios: document.getElementById('fComentarios').value.trim(),
            categoriaCambio: document.getElementById('fCategoria').value.trim(),
            riesgo: document.getElementById('fRiesgo').value.trim(),
            impacto: document.getElementById('fImpacto').value.trim(),
            afectaProduccion: document.getElementById('fAfecta').value === 'Sí',
            tieneLogs: document.getElementById('fLogs').value === 'Sí',
            requiereMonitoreoGrafana: document.getElementById('fGrafana').value === 'Sí',
            requiereMonitoreoZabbix: document.getElementById('fZabbix').value === 'Sí',
            componentes: document.getElementById('fComponentes').value.trim(),
            duracionActividad: document.getElementById('fDuracion').value.trim(),
            tiempoAfectacionOperativa: document.getElementById('fAfectacion').value.trim(),
            team: document.getElementById('fTeam').value.trim(),
            estatusControlCambios: document.getElementById('fEstatusCC').value.trim(),
            documentacionFolioCC: document.getElementById('fDocFolio').value.trim(),
            createdAt: serverTimestamp(),
            creadoPor: { uid: user.uid, nombre: user.displayName || 'Sin nombre', email: user.email }
        };

        const folioId = document.getElementById('folioId').value;

        if (folioId) {
            // Editar: preservar createdAt, actualizar updatedAt y mantener folioCC del padre
            delete data.createdAt;
            data.updatedAt = serverTimestamp();
            await updateDoc(doc(db, 'nuevoCC', ccId, 'folios', folioId), data);

            // Optimista (incluye folioCC)
            const i = foliosRows.findIndex(f => f.id === folioId);
            if (i > -1) foliosRows[i] = { ...foliosRows[i], ...data, folioCC: folioCCPadre };
            aplicarFiltroPaginacion();
            actualizarGraficas();

            Swal.fire('Actualizado', 'El folio fue actualizado.', 'success');
        } else {
            // Crear: guardar y reflejar en UI con folioCC del padre
            const ref = await addDoc(collection(db, 'nuevoCC', ccId, 'folios'), data);
            foliosRows.unshift({ id: ref.id, ...data, folioCC: folioCCPadre });
            aplicarFiltroPaginacion();
            actualizarGraficas();

            Swal.fire('Registrado', 'El folio fue agregado.', 'success');
        }

        // Relectura desde servidor (coherencia final)
        if (typeof getDocsFromServer === 'function') {
            await cargarFolios();
        }

        formFolio.reset();
        modalFolio?.hide();

    } catch (err) {
        console.error("❌ Error al guardar folio:", err);
        Swal.fire('Error', 'No se pudo guardar el folio.', 'error');
    }
});

tabla?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;

    // 🗑️ Eliminar
    if (action === 'del') {
        const ok = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar folio?',
            text: 'Esta acción no se puede deshacer.',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar'
        });
        if (!ok.isConfirmed) return;

        await deleteDoc(doc(db, 'nuevoCC', ccId, 'folios', id));
        foliosRows = foliosRows.filter(f => f.id !== id);
        aplicarFiltroPaginacion();
        actualizarGraficas();
        await cargarFolios();
        Swal.fire('Eliminado', 'El folio fue eliminado.', 'success');
    }

    // ✏️ Editar
    if (action === 'edit') {
        try {
            const docRef = doc(db, 'nuevoCC', ccId, 'folios', id);
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists()) {
                Swal.fire('Error', 'No se encontró el folio.', 'error');
                return;
            }
            const data = docSnap.data();

            // ✅ Cargar datos en el formulario
            document.getElementById('folioId').value = id;
            document.getElementById('fRevision').value = data.revision || '';
            document.getElementById('fCelula').value = data.celulaTI || '';
            document.getElementById('fEstatus').value = data.estatus || '';
            document.getElementById('fTipo').value = data.tipo || '';
            document.getElementById('fFolio').value = data.folio || '';
            document.getElementById('fDescripcion').value = data.descripcion || '';
            document.getElementById('fComentarios').value = data.comentarios || '';
            document.getElementById('fCategoria').value = data.categoriaCambio || '';
            document.getElementById('fRiesgo').value = data.riesgo || '';
            document.getElementById('fImpacto').value = data.impacto || '';
            document.getElementById('fAfecta').value = data.afectaProduccion ? 'Sí' : 'No';
            document.getElementById('fLogs').value = data.tieneLogs ? 'Sí' : 'No';
            document.getElementById('fGrafana').value = data.requiereMonitoreoGrafana ? 'Sí' : 'No';
            document.getElementById('fZabbix').value = data.requiereMonitoreoZabbix ? 'Sí' : 'No';
            document.getElementById('fComponentes').value = data.componentes || '';
            document.getElementById('fDuracion').value = data.duracionActividad || '';
            document.getElementById('fAfectacion').value = data.tiempoAfectacionOperativa || '';
            document.getElementById('fTeam').value = data.team || '';
            document.getElementById('fEstatusCC').value = data.estatusControlCambios || '';
            document.getElementById('fDocFolio').value = data.documentacionFolioCC || '';

            // ✅ Mostrar modal
            const modal = new bootstrap.Modal(document.getElementById('modalFolio'));
            modal.show();

        } catch (err) {
            console.error('❌ Error al cargar folio para editar:', err);
            Swal.fire('Error', 'No se pudo cargar la información del folio.', 'error');
        }
    }
});


// --- Búsqueda ---
buscarFolio?.addEventListener('input', e => {
    filtro = (e.target.value || '').toLowerCase();
    page = 1; aplicarFiltroPaginacion();
});

// --- Sesión y carga ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        Swal.fire({ icon: 'warning', title: 'Sesión expirada', text: 'Por favor inicia sesión nuevamente.' })
            .then(() => location.href = '/index.html');
    } else {
        inicializarGraficas();
        cargarCC();
        cargarFolios(); // carga una vez
    }
});

// 📦 Exportar CC + Folios con formato visual
document.getElementById("btnExportarFolios")?.addEventListener("click", async () => {
    try {
        Swal.fire({
            title: "Generando Excel...",
            text: "Por favor espera un momento.",
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading(),
        });

        const ccRef = doc(db, "nuevoCC", ccId);
        const ccSnap = await getDoc(ccRef);
        if (!ccSnap.exists()) {
            Swal.close();
            Swal.fire("Sin datos", "No existe el CC", "info");
            return;
        }

        const cc = ccSnap.data();
        const foliosSnap = await getDocs(collection(db, "nuevoCC", ccId, "folios"));

        const formatoBool = (v) => (v ? "Sí" : "No");
        const formatoFecha = (v) => {
            try {
                const dt = v?.toDate ? v.toDate() : v ? new Date(v) : null;
                if (!dt) return "";
                return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(
                    2,
                    "0"
                )}/${dt.getFullYear()}`;
            } catch {
                return "";
            }
        };

        // --- 🧩 Hoja CC (solo información principal) ---
        const hojaCC = [
            ["Campo", "Valor"],
            ["Folio CC", cc.folioCC || ""],
            ["Solicitante", cc.solicitante || ""],
            ["UID", cc.uid || ""],
            ["Fecha creación", formatoFecha(cc.fecha)],
            ["Fecha cambio", formatoFecha(cc.fechaCambio)],
            ["Revisión", cc.revision || ""],
            ["Célula TI", cc.celulaTI || ""],
            ["Tipo", cc.tipo || ""],
            ["Estatus CC", cc.estatusCC || ""],
        ];

        const wsCC = XLSX.utils.aoa_to_sheet(hojaCC);

        // --- 🧩 Hoja Folios (todos los folios del CC) ---
        const hojaFolios = [
            [
                "Folio CC",
                "Folio",
                "Revisión",
                "Célula TI",
                "Tipo",
                "Estatus",
                "Categoría del Cambio",
                "Riesgo",
                "Impacto",
                "Afecta Producción",
                "Tiene Logs",
                "Monitoreo Grafana",
                "Monitoreo Zabbix",
                "Componentes",
                "Duración Actividad",
                "Tiempo Afectación Operativa",
                "Team",
                "Estatus Control de Cambios",
                "Documentación Folio CC",
            ],
        ];

        foliosSnap.forEach((d) => {
            const f = d.data();
            hojaFolios.push([
                f.folioCC || "",
                f.folio || "",
                f.revision || "",
                f.celulaTI || "",
                f.tipo || "",
                f.estatus || "",
                f.categoriaCambio || "",
                f.riesgo || "",
                f.impacto || "",
                formatoBool(f.afectaProduccion),
                formatoBool(f.tieneLogs),
                formatoBool(f.requiereMonitoreoGrafana),
                formatoBool(f.requiereMonitoreoZabbix),
                f.componentes || "",
                f.duracionActividad || "",
                f.tiempoAfectacionOperativa || "",
                f.team || "",
                f.estatusControlCambios || "",
                f.documentacionFolioCC || "",
            ]);
        });

        const wsFolios = XLSX.utils.aoa_to_sheet(hojaFolios);

        // --- 🎨 Formato visual de encabezado ---
        const encabezadoStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "1F4E78" } },
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
        };

        // Aplica formato a la primera fila (encabezado)
        const rango = XLSX.utils.decode_range(wsFolios["!ref"]);
        for (let C = rango.s.c; C <= rango.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
            if (!wsFolios[cellAddress]) continue;
            wsFolios[cellAddress].s = encabezadoStyle;
        }

        // Ajuste automático de ancho de columnas
        const colWidths = hojaFolios[0].map((_, i) => {
            const maxLen = hojaFolios.reduce(
                (max, row) => Math.max(max, (row[i] ? row[i].toString().length : 0)),
                10
            );
            return { wch: Math.min(maxLen + 4, 50) }; // ancho máximo razonable
        });
        wsFolios["!cols"] = colWidths;

        // --- 📘 Crear y guardar archivo ---
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsCC, "CC");
        XLSX.utils.book_append_sheet(wb, wsFolios, "Folios");

        const fecha = new Date();
        const nombreArchivo = `CC_${cc.folioCC || ccId}_${fecha.getFullYear()}-${String(
            fecha.getMonth() + 1
        ).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}.xlsx`;

        // ✅ Exporta con formato
        XLSX.writeFile(wb, nombreArchivo, { cellStyles: true });

        Swal.close();
        Swal.fire("Descargado", "El archivo Excel fue generado correctamente.", "success");
    } catch (err) {
        console.error("❌ Error exportando Excel:", err);
        Swal.close();
        Swal.fire("Error", "No se pudo generar el archivo Excel.", "error");
    }
});

