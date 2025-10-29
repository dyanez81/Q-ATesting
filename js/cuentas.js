// /js/cuentas.js
import { db, auth } from "./firebase-config.js";
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    getDocsFromServer,
    serverTimestamp,
    arrayUnion,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs";

// ------------------ DOM ------------------
const tabla = document.getElementById("tablaCuentas");
const buscar = document.getElementById("buscarCuenta");
const paginacionEl = document.getElementById("paginacion");
const infoPaginacionEl = document.getElementById("infoPaginacion");

const modalCuentaEl = document.getElementById("modalCuenta");
const modalCuenta = modalCuentaEl ? new bootstrap.Modal(modalCuentaEl) : null;
const formCuenta = document.getElementById("formCuenta");
const cuentaIdInput = document.getElementById("cuentaId");

// Comentarios
const modalComentariosEl = document.getElementById("modalComentarios");
const modalComentarios = modalComentariosEl ? new bootstrap.Modal(modalComentariosEl) : null;

// ------------------ Estado ------------------
let rows = [];
let page = 1;
const pageSize = 10;
let filtro = '';
let cuentaSeleccionadaComentarios = null;

// ------------------ Utilidades ------------------
function generarTelefonoAuto() {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const aa = String(now.getFullYear()).slice(-2);
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${dd}${mm}${aa}${min}${ss}`;
}

function parseAsignadoA(text) {
    if (!text) return [];
    return text.split(",").map(s => s.trim()).filter(Boolean);
}

function formatDate(v) {
    try {
        const dt = v?.toDate ? v.toDate() : (v ? new Date(v) : null);
        if (!dt) return "";
        const d = String(dt.getDate()).padStart(2, "0");
        const m = String(dt.getMonth() + 1).padStart(2, "0");
        const y = dt.getFullYear();
        const hh = String(dt.getHours()).padStart(2, "0");
        const mm = String(dt.getMinutes()).padStart(2, "0");
        return `${d}/${m}/${y} ${hh}:${mm}`;
    } catch { return ""; }
}

function bool(v) { return v ? 'Sí' : 'No'; }

// ------------------ Render tabla + paginación ------------------
function aplicarFiltroPaginacion() {
    const data = rows.filter(r =>
        (r.telefono || '').toLowerCase().includes(filtro) ||
        (r.correo || '').toLowerCase().includes(filtro)
    );

    data.sort((a, b) => {
        const ta = (a.updatedAt?.toMillis?.() ? a.updatedAt.toMillis() : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0))
            || (a.createdAt?.toMillis?.() ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0));
        const tb = (b.updatedAt?.toMillis?.() ? b.updatedAt.toMillis() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0))
            || (b.createdAt?.toMillis?.() ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0));
        return tb - ta;
    });

    const total = data.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (page > totalPages) page = totalPages;
    const start = (page - 1) * pageSize;
    const slice = data.slice(start, start + pageSize);

    tabla.innerHTML = slice.map((r, idx) => `
    <tr>
      <td>${start + idx + 1}</td>
      <td>${r.telefono || '-'}</td>
      <td>${r.correo || '-'}</td>
      <td>${r.tipoCuenta || '-'}</td>
      <td><span class="text-monospace">${r.contraseña || '-'}</span></td>
      <td>
        <span class="badge ${r.estatus === 'Activa' ? 'bg-success' :
            r.estatus === 'Pendiente' ? 'bg-warning text-dark' :
                r.estatus === 'PLD' ? 'bg-danger' : 'bg-secondary'
        }">${r.estatus || '-'}</span>
      </td>
      <td class="text-nowrap">
        <button class="btn btn-sm btn-outline-primary" data-id="${r.id}" data-action="edit">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-secondary" data-id="${r.id}" data-action="comments">
          <i class="bi bi-chat-dots"></i>
        </button>
      </td>
    </tr>
  `).join('');

    infoPaginacionEl.textContent = `${total === 0 ? 0 : start + 1}-${Math.min(start + pageSize, total)} de ${total}`;
}

// ------------------ Cargar cuentas ------------------
async function cargarCuentas() {
    try {
        tabla.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Cargando cuentas...</td></tr>`;
        const ref = collection(db, "cuentas_pruebas");
        const snap = await getDocsFromServer(ref);
        rows = [];
        snap.forEach(docSnap => {
            const d = docSnap.data();
            rows.push({
                id: docSnap.id,
                telefono: d.telefono || "",
                correo: d.correo || "",
                tipoCuenta: d.tipoCuenta || "",
                contraseña: d.contraseña || "",
                estatus: d.estatus || "",
                asignadoA: Array.isArray(d.asignadoA) ? d.asignadoA : [],
                caracteristicas: d.caracteristicas || { inversiones: false, saldo: false, tdc: false, tdd: false, tdcg: false },
                createdAt: d.createdAt || null,
                updatedAt: d.updatedAt || null,
            });
        });
        aplicarFiltroPaginacion();
    } catch (err) {
        console.error("❌ Error cargando cuentas:", err);
        tabla.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error al cargar.</td></tr>`;
    }
}

// ------------------ Modal NUEVA/EDITAR cuenta ------------------
// 🔹 Solo limpiar el formulario si se abre desde el botón "Nueva cuenta"
modalCuentaEl?.addEventListener("show.bs.modal", (e) => {
  const trigger = e.relatedTarget;

  // Si se abrió desde el botón "Nueva cuenta"
  if (trigger && trigger.id === "btnNuevaCuenta") {
    cuentaIdInput.value = "";
    formCuenta.reset();

    document.getElementById("cTelefono").value = generarTelefonoAuto();
    document.getElementById("cCorreo").value = "pruebasqafin+00@gmail.com";
    document.getElementById("cPassword").value = "PruebasDev153$";
  }
});



// Guardar cuenta
formCuenta?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const user = auth.currentUser;
        if (!user) {
            Swal.fire("Sesión expirada", "Inicia sesión nuevamente.", "warning");
            return;
        }

        const id = cuentaIdInput.value;
        const payload = {
            telefono: document.getElementById("cTelefono").value.trim() || generarTelefonoAuto(),
            correo: document.getElementById("cCorreo").value.trim() || "pruebasqafin+00@gmail.com",
            contraseña: document.getElementById("cPassword").value.trim() || "PruebasDev153$",
            tipoCuenta: document.getElementById("cTipo").value.trim(),
            estatus: document.getElementById("cEstatus").value.trim(),
            asignadoA: parseAsignadoA(document.getElementById("cAsignado").value),
            caracteristicas: {
                inversiones: document.getElementById("carInversiones").checked,
                saldo: document.getElementById("carSaldo").checked,
                tdc: document.getElementById("carTDC").checked,
                tdd: document.getElementById("carTDD").checked,
                tdcg: document.getElementById("carTDCG").checked,
            },
            updatedAt: serverTimestamp(),
        };

        if (id) {
            await updateDoc(doc(db, "cuentas_pruebas", id), payload);
            Swal.fire("Actualizado", "La cuenta fue actualizada.", "success");
        } else {
            await addDoc(collection(db, "cuentas_pruebas"), { ...payload, createdAt: serverTimestamp() });
            Swal.fire("Registrado", "La cuenta fue agregada.", "success");
        }

        cuentaIdInput.value = "";
        formCuenta.reset();
        modalCuenta?.hide();
        await cargarCuentas();
    } catch (err) {
        console.error("❌ Error al guardar cuenta:", err);
        Swal.fire("Error", "No se pudo guardar la cuenta.", "error");
    }
});

// ------------------ Comentarios: Cargar y agregar ------------------
async function cargarComentarios(cuentaId) {
    const contenedor = document.getElementById("listaComentarios");
    contenedor.innerHTML = `<p class="text-center text-muted mb-0">Cargando comentarios...</p>`;

    try {
        const ref = collection(db, "cuentas_pruebas", cuentaId, "comentarios");
        const snapshot = await getDocs(ref);

        if (snapshot.empty) {
            contenedor.innerHTML = `<p class="text-center text-muted mb-0">No hay comentarios aún.</p>`;
            return;
        }

        let html = "";
        snapshot.forEach((docSnap) => {
            const c = docSnap.data();
            const fecha = c.fecha?.toDate ? c.fecha.toDate() : new Date();
            const fechaFmt = fecha.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
            html += `
        <div class="border rounded p-2 mb-2 bg-light">
          <div class="small text-muted mb-1">
            <strong>${c.autor || "Anónimo"}</strong> · ${fechaFmt}
          </div>
          <div>${c.texto || ""}</div>
        </div>`;
        });
        contenedor.innerHTML = html;
    } catch (err) {
        console.error("❌ Error al cargar comentarios:", err);
        contenedor.innerHTML = `<p class="text-center text-danger mb-0">Error al cargar comentarios.</p>`;
    }
}

document.getElementById("formComentario")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const texto = document.getElementById("comentarioTexto").value.trim();
    if (!texto || !cuentaSeleccionadaComentarios) return;

    try {
        const user = auth.currentUser;
        if (!user) {
            Swal.fire("Sesión expirada", "Inicia sesión nuevamente.", "warning");
            return;
        }

        await addDoc(collection(db, "cuentas_pruebas", cuentaSeleccionadaComentarios, "comentarios"), {
            autor: user.email || "Usuario",
            texto,
            fecha: serverTimestamp(),
        });

        document.getElementById("comentarioTexto").value = "";
        await cargarComentarios(cuentaSeleccionadaComentarios);
    } catch (err) {
        console.error("❌ Error al guardar comentario:", err);
        Swal.fire("Error", "No se pudo guardar el comentario.", "error");
    }
});

// ------------------ Abrir modal de edición o comentarios ------------------
tabla?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === "edit") {
        try {
            const ref = doc(db, "cuentas_pruebas", id);
            const snap = await getDoc(ref);
            if (!snap.exists()) {
                Swal.fire("Error", "No se encontró la cuenta.", "error");
                return;
            }

            const d = snap.data();
            cuentaIdInput.value = id;
            document.getElementById("cTelefono").value = d.telefono || generarTelefonoAuto();
            document.getElementById("cCorreo").value = d.correo || "pruebasqafin+00@gmail.com";
            document.getElementById("cPassword").value = d.contraseña || "PruebasDev153$";
            document.getElementById("cTipo").value = d.tipoCuenta || "N0";
            document.getElementById("cEstatus").value = d.estatus || "Activa";
            document.getElementById("cAsignado").value = Array.isArray(d.asignadoA) ? d.asignadoA.join(", ") : "";
            document.getElementById("carInversiones").checked = d.caracteristicas?.inversiones || false;
            document.getElementById("carSaldo").checked = d.caracteristicas?.saldo || false;
            document.getElementById("carTDC").checked = d.caracteristicas?.tdc || false;
            document.getElementById("carTDD").checked = d.caracteristicas?.tdd || false;
            document.getElementById("carTDCG").checked = d.caracteristicas?.tdcg || false;

            modalCuenta?.show();
        } catch (err) {
            console.error("❌ Error al editar cuenta:", err);
            Swal.fire("Error", "No se pudo cargar la cuenta.", "error");
        }
    }

    if (action === "comments") {
        cuentaSeleccionadaComentarios = id;
        await cargarComentarios(id);
        modalComentarios?.show();
    }
});

// ------------------ Exportar Excel ------------------
document.getElementById("btnExportarExcel")?.addEventListener("click", async () => {
    try {
        Swal.fire({ title: "Generando Excel...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const snap = await getDocs(collection(db, "cuentas_pruebas"));
        const cuentas = [];
        const comentarios = [];
        snap.forEach(d => {
            const x = d.data();
            cuentas.push({
                "Teléfono": x.telefono || "",
                "Correo": x.correo || "",
                "Tipo": x.tipoCuenta || "",
                "Contraseña": x.contraseña || "",
                "Estatus": x.estatus || "",
                "Asignado A": Array.isArray(x.asignadoA) ? x.asignadoA.join(", ") : "",
                "Inv": bool(x?.caracteristicas?.inversiones),
                "Saldo": bool(x?.caracteristicas?.saldo),
                "TDC": bool(x?.caracteristicas?.tdc),
                "TDD": bool(x?.caracteristicas?.tdd),
                "TDCG": bool(x?.caracteristicas?.tdcg),
                "Creado": formatDate(x.createdAt),
                "Actualizado": formatDate(x.updatedAt),
            });
        });

        const wb = XLSX.utils.book_new();
        const ws1 = XLSX.utils.json_to_sheet(cuentas);
        XLSX.utils.book_append_sheet(wb, ws1, "Cuentas");
        XLSX.writeFile(wb, "cuentas_pruebas.xlsx");
        Swal.close();
        Swal.fire("Descargado", "Archivo Excel generado correctamente.", "success");
    } catch (err) {
        console.error("❌ Error exportando:", err);
        Swal.fire("Error", "No se pudo exportar el Excel.", "error");
    }
});

// ------------------ Sesión ------------------
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        Swal.fire({ icon: "warning", title: "Sesión expirada", text: "Por favor inicia sesión nuevamente." })
            .then(() => location.href = "/index.html");
    } else {
        await cargarCuentas();
    }
});
