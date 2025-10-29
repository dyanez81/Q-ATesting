// /js/contrasenas.js
import { db, auth } from "./firebase-config.js";
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    getDoc,
    getDocs,
    getDocsFromServer,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs";

// AES reversible (CryptoJS ESM)
import CryptoJS from "https://cdn.jsdelivr.net/npm/crypto-js@4.2.0/+esm";

// =================== Config ===================
const SECRET_KEY = "QA-Finsus-2025"; // TODO: mover a una config segura en producción

// =================== DOM ===================
const tabla = document.getElementById("tablaContrasenas");
const buscar = document.getElementById("buscarContrasena");
const paginacionEl = document.getElementById("paginacion");
const infoPaginacionEl = document.getElementById("infoPaginacion");

const modalContrasenaEl = document.getElementById("modalContrasena");
const modalContrasena = modalContrasenaEl ? new bootstrap.Modal(modalContrasenaEl) : null;
const formContrasena = document.getElementById("formContrasena");
const contrasenaIdInput = document.getElementById("contrasenaId");
const btnTogglePwd = document.getElementById("btnTogglePwd");

// Ver contraseña
const modalVerPwdEl = document.getElementById("modalVerPwd");
const modalVerPwd = modalVerPwdEl ? new bootstrap.Modal(modalVerPwdEl) : null;
const claveMaestraInput = document.getElementById("claveMaestra");
const btnVerPwd = document.getElementById("btnVerPwd");
const outPwd = document.getElementById("outPwd");

// =================== Estado ===================
let rows = [];           // arreglo plano con docs
let rawDocs = {};        // cache: id -> doc data cruda
let page = 1;
const pageSize = 10;
let filtro = "";

let verPwdDocId = null;  // id del doc para ver contraseña

// =================== Utils ===================
function encryptPassword(plain) {
    return CryptoJS.AES.encrypt(plain, SECRET_KEY).toString();
}
function decryptPassword(cipher) {
    const bytes = CryptoJS.AES.decrypt(cipher, SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
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
async function contarSubcuentas(id) {
    try {
        const snap = await getDocs(collection(db, "resguardo_contrasenas", id, "subcuentas"));
        return snap.size || 0;
    } catch {
        return 0;
    }
}

// =================== Render + paginación ===================
async function renderTabla() {
    const data = rows.filter(r =>
        (r.url || '').toLowerCase().includes(filtro) ||
        (r.usuario || '').toLowerCase().includes(filtro)
    );

    // ordenar por fechaCambio desc (fallback fechaRegistro)
    data.sort((a, b) => {
        const ta = (a.fechaCambio?.toMillis?.() ? a.fechaCambio.toMillis() : (a.fechaCambio ? new Date(a.fechaCambio).getTime() : 0))
            || (a.fechaRegistro?.toMillis?.() ? a.fechaRegistro.toMillis() : (a.fechaRegistro ? new Date(a.fechaRegistro).getTime() : 0));
        const tb = (b.fechaCambio?.toMillis?.() ? b.fechaCambio.toMillis() : (b.fechaCambio ? new Date(b.fechaCambio).getTime() : 0))
            || (b.fechaRegistro?.toMillis?.() ? b.fechaRegistro.toMillis() : (b.fechaRegistro ? new Date(b.fechaRegistro).getTime() : 0));
        return tb - ta;
    });

    const total = data.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (page > totalPages) page = totalPages;
    const start = (page - 1) * pageSize;
    const slice = data.slice(start, start + pageSize);

    // Render base (sin counts aún)
    tabla.innerHTML = slice.map((r, idx) => `
    <tr data-id="${r.id}">
      <td>${start + idx + 1}</td>
      <td><a href="${r.url || '#'}" target="_blank" rel="noopener">${r.url || '-'}</a></td>
      <td>${r.usuario || '-'}</td>
      <td>${formatDate(r.fechaRegistro) || '-'}</td>
      <td>${formatDate(r.fechaCambio) || '-'}</td>
      <td class="subcuentas-cell"><span class="badge bg-secondary">...</span></td>
      <td class="text-nowrap">
        <button class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${r.id}">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-dark" data-action="viewpwd" data-id="${r.id}" title="Ver contraseña">
          <i class="bi bi-key"></i>
        </button>
        <a class="btn btn-sm btn-outline-secondary" href="/subcuentas.html?id=${r.id}" title="Subcuentas">
          <i class="bi bi-people"></i>
        </a>
      </td>
    </tr>
  `).join('');

    // Info paginación
    infoPaginacionEl.textContent = `${total === 0 ? 0 : start + 1}-${Math.min(start + pageSize, total)} de ${total}`;

    // Render counts de subcuentas (en paralelo)
    slice.forEach(async (r) => {
        const tr = tabla.querySelector(`tr[data-id="${r.id}"]`);
        const cell = tr?.querySelector(".subcuentas-cell");
        if (cell) {
            const n = await contarSubcuentas(r.id);
            cell.innerHTML = `<span class="badge ${n > 0 ? 'bg-success' : 'bg-secondary'}">${n}</span>`;
        }
    });

    // Paginación
    paginacionEl.innerHTML = '';
    const maxPages = Math.max(1, Math.ceil(total / pageSize));
    const totalPagesToShow = Math.min(7, maxPages);
    const startPage = Math.max(1, Math.min(page - 3, (maxPages - totalPagesToShow) + 1));

    const liPrev = document.createElement('li');
    liPrev.className = `page-item ${page === 1 ? 'disabled' : ''}`;
    liPrev.innerHTML = `<a class="page-link" href="#">«</a>`;
    liPrev.onclick = (e) => { e.preventDefault(); if (page > 1) { page--; renderTabla(); } };
    paginacionEl.appendChild(liPrev);

    for (let p = startPage; p < startPage + totalPagesToShow; p++) {
        const li = document.createElement('li');
        li.className = `page-item ${p === page ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#">${p}</a>`;
        li.onclick = (e) => { e.preventDefault(); page = p; renderTabla(); };
        paginacionEl.appendChild(li);
    }

    const liNext = document.createElement('li');
    liNext.className = `page-item ${page === maxPages ? 'disabled' : ''}`;
    liNext.innerHTML = `<a class="page-link" href="#">»</a>`;
    liNext.onclick = (e) => { e.preventDefault(); if (page < maxPages) { page++; renderTabla(); } };
    paginacionEl.appendChild(liNext);
}

// =================== Carga inicial ===================
async function cargarContrasenas() {
    try {
        tabla.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Cargando registros...</td></tr>`;
        const ref = collection(db, "resguardo_contrasenas");
        const snap = await getDocsFromServer(ref);
        rows = [];
        rawDocs = {};
        snap.forEach(docSnap => {
            const d = docSnap.data();
            rows.push({
                id: docSnap.id,
                url: d.url || "",
                usuario: d.usuario || "",
                contraseña: d.contraseña || "",       // cifrada
                fechaRegistro: d.fechaRegistro || null,
                fechaCambio: d.fechaCambio || null,
            });
            rawDocs[docSnap.id] = d;
        });
        await renderTabla();
    } catch (err) {
        console.error("❌ Error cargando contraseñas:", err);
        tabla.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error al cargar.</td></tr>`;
    }
}

// =================== Búsqueda ===================
buscar?.addEventListener('input', (e) => {
    filtro = (e.target.value || '').toLowerCase();
    page = 1;
    renderTabla();
});

// =================== Modal NUEVA/EDITAR ===================

// Solo limpiar si es NUEVO (cuando viene del botón "Nueva contraseña")
modalContrasenaEl?.addEventListener("show.bs.modal", (e) => {
    const trigger = e.relatedTarget;
    if (trigger && trigger.id === "btnNuevaContrasena") {
        contrasenaIdInput.value = "";
        formContrasena.reset();
    }
});

// Mostrar/ocultar password input
btnTogglePwd?.addEventListener("click", () => {
    const input = document.getElementById("cPassword");
    const isPwd = input.type === "password";
    input.type = isPwd ? "text" : "password";
    btnTogglePwd.innerHTML = isPwd ? `<i class="bi bi-eye-slash"></i>` : `<i class="bi bi-eye"></i>`;
});

// Guardar (crear/editar)
formContrasena?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
        const user = auth.currentUser;
        if (!user) {
            Swal.fire("Sesión expirada", "Inicia sesión nuevamente.", "warning");
            return;
        }

        const id = contrasenaIdInput.value;
        const url = document.getElementById("cUrl").value.trim();
        const usuario = document.getElementById("cUsuario").value.trim();
        const pwdPlain = document.getElementById("cPassword").value.trim();

        const payloadBase = {
            url,
            usuario,
            fechaCambio: serverTimestamp(),
        };

        if (id) {
            // editar: si el campo contraseña está vacío, no se cambia; si trae texto, se cifra
            const data = { ...payloadBase };
            if (pwdPlain) data.contraseña = encryptPassword(pwdPlain);
            await updateDoc(doc(db, "resguardo_contrasenas", id), data);
            Swal.fire("Actualizado", "El registro fue actualizado.", "success");
        } else {
            // crear: se requiere contraseña
            if (!pwdPlain) {
                Swal.fire("Falta contraseña", "Ingresa una contraseña para cifrar.", "warning");
                return;
            }
            const nuevo = {
                ...payloadBase,
                fechaRegistro: serverTimestamp(),
                contraseña: encryptPassword(pwdPlain),
            };
            await addDoc(collection(db, "resguardo_contrasenas"), nuevo);
            Swal.fire("Registrado", "El registro fue agregado.", "success");
        }

        contrasenaIdInput.value = "";
        formContrasena.reset();
        modalContrasena?.hide();
        await cargarContrasenas();
    } catch (err) {
        console.error("❌ Error al guardar:", err);
        Swal.fire("Error", "No se pudo guardar el registro.", "error");
    }
});

// =================== Acciones en tabla ===================
tabla?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;

    // Editar
    if (action === "edit") {
        try {
            const ref = doc(db, "resguardo_contrasenas", id);
            const snap = await getDoc(ref);
            if (!snap.exists()) {
                Swal.fire("Error", "No se encontró el registro.", "error");
                return;
            }
            const d = snap.data();

            contrasenaIdInput.value = id;
            document.getElementById("cUrl").value = d.url || "";
            document.getElementById("cUsuario").value = d.usuario || "";
            document.getElementById("cPassword").value = ""; // mantener vacío; si el usuario escribe, se re-cifra

            modalContrasena?.show();
        } catch (err) {
            console.error("❌ Error al cargar para edición:", err);
            Swal.fire("Error", "No se pudo cargar el registro.", "error");
        }
    }

    // Ver contraseña (modal clave maestra)
    if (action === "viewpwd") {
        verPwdDocId = id;
        outPwd.value = "";
        claveMaestraInput.value = "";
        modalVerPwd?.show();
    }
});

// =================== Ver contraseña con clave maestra ===================
btnVerPwd?.addEventListener("click", async () => {
    try {
        const entered = (claveMaestraInput.value || "").trim();
        if (!entered) {
            Swal.fire("Clave requerida", "Ingresa la clave maestra.", "warning");
            return;
        }
        if (entered !== SECRET_KEY) {
            Swal.fire("Clave incorrecta", "La clave maestra no es válida.", "error");
            return;
        }
        if (!verPwdDocId) return;

        const d = rawDocs[verPwdDocId] || (await (async () => {
            const snap = await getDoc(doc(db, "resguardo_contrasenas", verPwdDocId));
            return snap.exists() ? snap.data() : null;
        })());
        if (!d) {
            Swal.fire("Error", "No se encontró el registro.", "error");
            return;
        }
        if (!d.contraseña) {
            outPwd.value = "";
            return;
        }

        // Desencriptar
        try {
            const plain = decryptPassword(d.contraseña);
            outPwd.value = plain || "(vacía)";
        } catch (e) {
            console.error("❌ Error al desencriptar:", e);
            Swal.fire("Error", "No se pudo desencriptar la contraseña.", "error");
        }
    } catch (err) {
        console.error("❌ Error ver contraseña:", err);
        Swal.fire("Error", "Ocurrió un problema.", "error");
    }
});

// =================== Exportar Excel ===================
document.getElementById("btnExportarExcel")?.addEventListener("click", async () => {
    try {
        Swal.fire({ title: "Generando Excel...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const snap = await getDocs(collection(db, "resguardo_contrasenas"));
        const registros = [];
        for (const d of snap.docs) {
            const x = d.data();
            // No exportamos la contraseña en texto plano; exportamos el cifrado
            const countSub = await contarSubcuentas(d.id);
            registros.push({
                "URL": x.url || "",
                "Usuario": x.usuario || "",
                "Fecha Registro": formatDate(x.fechaRegistro),
                "Fecha Cambio": formatDate(x.fechaCambio),
                "Subcuentas": countSub,
                "Contraseña (cifrada)": x.contraseña || ""
            });
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(registros);
        XLSX.utils.book_append_sheet(wb, ws, "Resguardo");

        // Estilo simple de encabezado
        const range = XLSX.utils.decode_range(ws['!ref']);
        const headerStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "1F4E78" } },
            alignment: { horizontal: "center", vertical: "center", wrapText: true }
        };
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell = XLSX.utils.encode_cell({ r: 0, c: C });
            if (ws[cell]) ws[cell].s = headerStyle;
        }
        // autosize
        const dataAOA = XLSX.utils.sheet_to_json(ws, { header: 1 });
        ws["!cols"] = dataAOA[0].map((_, c) => {
            const maxLen = dataAOA.reduce((m, row) => Math.max(m, (row[c] ? String(row[c]).length : 0)), 10);
            return { wch: Math.min(maxLen + 4, 60) };
        });

        const fecha = new Date();
        const nombre = `Resguardo_${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}.xlsx`;
        XLSX.writeFile(wb, nombre, { cellStyles: true });

        Swal.close();
        Swal.fire("Descargado", "Archivo Excel generado correctamente.", "success");
    } catch (err) {
        console.error("❌ Error exportando:", err);
        Swal.fire("Error", "No se pudo exportar el Excel.", "error");
    }
});

// =================== Sesión y arranque ===================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        Swal.fire({ icon: "warning", title: "Sesión expirada", text: "Por favor inicia sesión nuevamente." })
            .then(() => (location.href = "/index.html"));
    } else {
        await cargarContrasenas();
    }
});
