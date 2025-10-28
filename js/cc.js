// /js/cc.js
import { db, auth } from "./firebase-config.js";
import {
    collection,
    addDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    getDocs,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs";

// --- Referencias DOM ---
const tabla = document.getElementById("tablaCC");
const formCC = document.getElementById("formCC");
const modalEl = document.getElementById("modalCC");
const modalCC = modalEl ? new bootstrap.Modal(modalEl) : null;
const buscarCC = document.getElementById("buscarCC");
const paginacionEl = document.getElementById("paginacion");
const infoPaginacionEl = document.getElementById("infoPaginacion");

// --- Estado de tabla ---
let ccRows = [];
let page = 1;
const pageSize = 10;
let filtro = "";

// --- Render paginado ---
function aplicarFiltroPaginacion() {
    const data = ccRows.filter(r =>
        (r.folioCC || '').toLowerCase().includes(filtro) ||
        (r.solicitante || '').toLowerCase().includes(filtro) ||
        (r.creadoPorNombre || '').toLowerCase().includes(filtro)
    );

    const total = data.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (page > totalPages) page = totalPages;
    const start = (page - 1) * pageSize;
    const slice = data.slice(start, start + pageSize);

    tabla.innerHTML = slice.map((r, idx) => `
    <tr>
      <td>${start + idx + 1}</td>
      <td>${r.folioCC}</td>
      <td>${r.solicitante || '-'}</td>
      <td>${r.revision || '-'}</td>
      <td>${r.celulaTI || '-'}</td>
      <td>${r.tipo || '-'}</td>
      <td><span class="badge bg-${r.estatusCC === 'Cerrado' ? 'success' : 'secondary'}">${r.estatusCC || '-'}</span></td>
      <td>${r.riesgo || '-'}</td>
      <td>${r.impacto || '-'}</td>
      <td>${r.creadoPorNombre || '-'}</td>
      <td class="text-center">
        <a class="btn btn-sm btn-primary" href="/folios-cc.html?id=${r.id}">
          <i class="bi bi-eye"></i> Ver folios
        </a>
      </td>
    </tr>
  `).join('');

    // Paginación visual
    infoPaginacionEl.textContent = `${total === 0 ? 0 : start + 1}-${Math.min(start + pageSize, total)} de ${total}`;
    paginacionEl.innerHTML = "";

    const liPrev = document.createElement("li");
    liPrev.className = `page-item ${page === 1 ? "disabled" : ""}`;
    liPrev.innerHTML = `<a class="page-link" href="#">«</a>`;
    liPrev.onclick = e => { e.preventDefault(); if (page > 1) { page--; aplicarFiltroPaginacion(); } };
    paginacionEl.appendChild(liPrev);

    const totalPagesToShow = Math.min(7, totalPages);
    const startPage = Math.max(1, Math.min(page - 3, totalPages - totalPagesToShow + 1));
    for (let p = startPage; p < startPage + totalPagesToShow; p++) {
        const li = document.createElement("li");
        li.className = `page-item ${p === page ? "active" : ""}`;
        li.innerHTML = `<a class="page-link" href="#">${p}</a>`;
        li.onclick = e => { e.preventDefault(); page = p; aplicarFiltroPaginacion(); };
        paginacionEl.appendChild(li);
    }

    const liNext = document.createElement("li");
    liNext.className = `page-item ${page === totalPages ? "disabled" : ""}`;
    liNext.innerHTML = `<a class="page-link" href="#">»</a>`;
    liNext.onclick = e => { e.preventDefault(); if (page < totalPages) { page++; aplicarFiltroPaginacion(); } };
    paginacionEl.appendChild(liNext);
}

// --- Cargar CCs en tiempo real ---
function cargarCC() {
    tabla.innerHTML = `<tr><td colspan="11" class="text-center py-4 text-muted">Cargando registros...</td></tr>`;
    const ref = collection(db, "nuevoCC");
    onSnapshot(query(ref, orderBy("fecha", "desc")), (snapshot) => {
        ccRows = [];
        if (snapshot.empty) {
            tabla.innerHTML = `<tr><td colspan="11" class="text-center py-4 text-muted">No hay registros.</td></tr>`;
            infoPaginacionEl.textContent = "";
            paginacionEl.innerHTML = "";
            return;
        }

        snapshot.forEach((docSnap) => {
            const c = docSnap.data();
            const id = docSnap.id;
            const riesgoClass = (c.riesgo === 'Alto') ? 'danger' : (c.riesgo === 'Medio' ? 'warning' : 'success');

            ccRows.push({
                id, // ✅ <── AGREGA ESTA LÍNEA
                folioCC: c.folioCC || "",
                solicitante: c.solicitante || "",
                revision: c.revision || "",
                celulaTI: c.celulaTI || "",
                tipo: c.tipo || "",
                estatusCC: c.estatusCC || "Pendiente",
                riesgo: c.riesgo || "",
                riesgoClass,
                impacto: c.impacto || "",
                creadoPorNombre: c.creadoPor?.nombre || ""
            });
        });

        aplicarFiltroPaginacion();
    });
}
// 🆕 Generar folio automático cuando se abre el modal
modalEl?.addEventListener('show.bs.modal', () => {
    const folioInput = document.getElementById('ccFolioCC');
    if (!folioInput) return; // ✅ Previene error si el elemento aún no existe
    const fecha = new Date();
    const meses = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
    const folio = `CC-${String(fecha.getDate()).padStart(2, '0')}${meses[fecha.getMonth()]}`;
    folioInput.value = folio;
});

// --- Guardar nuevo CC ---
formCC?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
        const user = auth.currentUser;
        if (!user) {
            Swal.fire("Sesión expirada", "Por favor inicia sesión nuevamente.", "warning");
            return;
        }

        const nuevoCC = {
            folioCC: document.getElementById("ccFolioCC").value.trim(),
            solicitante: document.getElementById("ccSolicitante").value.trim(),
            celulaTI: document.getElementById("ccCelula").value.trim(),
            revision: document.getElementById("ccRevision").value.trim(),
            tipo: document.getElementById("ccTipo").value.trim(),
            fechaCambio: new Date(document.getElementById("ccFechaCambio").value),
            fecha: serverTimestamp(),
            uid: user.uid,
            estatusCC: "Pendiente",
            creadoPor: { nombre: user.displayName || "Sin nombre", email: user.email }
        };

        await addDoc(collection(db, "nuevoCC"), nuevoCC);
        Swal.fire("Registrado", "El control de cambio fue agregado correctamente.", "success");
        formCC.reset();
        modalCC?.hide();
    } catch (error) {
        console.error("❌ Error al guardar CC:", error);
        Swal.fire("Error", "No se pudo guardar el control de cambio.", "error");
    }
});

// --- Buscar CC ---
buscarCC?.addEventListener("input", (e) => {
    filtro = (e.target.value || "").toLowerCase();
    page = 1;
    aplicarFiltroPaginacion();
});

// --- Exportar CCs a Excel ---
document.getElementById("btnExportarExcel")?.addEventListener("click", async () => {
    try {
        Swal.fire({ title: "Generando Excel...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const snapshot = await getDocs(collection(db, "nuevoCC"));
        if (snapshot.empty) {
            Swal.close();
            Swal.fire("Sin datos", "No hay controles de cambio registrados.", "info");
            return;
        }

        const registros = snapshot.docs.map((doc) => {
            const d = doc.data();
            const f = (v) => v?.toDate ? v.toDate().toLocaleString() : "";
            return {
                "ID": doc.id,
                "Solicitante": d.solicitante || "",
                "Revisión": d.revision || "",
                "Célula TI": d.celulaTI || "",
                "Tipo": d.tipo || "",
                "Estatus CC": d.estatusCC || "",
                "Fecha creación": f(d.fecha),
                "Fecha cambio": f(d.fechaCambio),
                "Creador": d.creadoPor?.nombre || "",
                "Email creador": d.creadoPor?.email || "",
            };
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(registros);
        XLSX.utils.book_append_sheet(wb, ws, "Controles de Cambio");
        XLSX.writeFile(wb, `ControlesCambio_${new Date().toISOString().slice(0, 10)}.xlsx`);
        Swal.close();
        Swal.fire("Descargado", "El archivo Excel fue generado correctamente.", "success");
    } catch (err) {
        console.error("Error exportando Excel:", err);
        Swal.close();
        Swal.fire("Error", "No se pudo generar el archivo Excel.", "error");
    }
});

// --- Sesión y carga inicial ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        Swal.fire({
            icon: "warning",
            title: "Sesión expirada",
            text: "Por favor inicia sesión nuevamente.",
        }).then(() => (window.location.href = "index.html"));
    } else {
        cargarCC();
    }
});
