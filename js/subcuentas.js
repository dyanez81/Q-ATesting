// /js/subcuentas.js
import { db, auth } from "./firebase-config.js";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs";

// =================== DOM ELEMENTOS ===================
const tabla = document.getElementById("tablaSubcuentas");
const buscar = document.getElementById("buscarSubcuenta");
const infoPaginacionEl = document.getElementById("infoPaginacion");
const paginacionEl = document.getElementById("paginacion");

const modalSubcuentaEl = document.getElementById("modalSubcuenta");
const modalSubcuenta = modalSubcuentaEl ? new bootstrap.Modal(modalSubcuentaEl) : null;
const formSubcuenta = document.getElementById("formSubcuenta");
const subcuentaIdInput = document.getElementById("subcuentaId");

const nombreCuentaEl = document.getElementById("nombreCuenta");

// 🔹 Botón para regresar a la vista de contraseñas
document.getElementById('btnRegresar')?.addEventListener('click', () => {
  window.location.href = 'contrasenas.html';
});


// =================== ESTADO ===================
let subcuentas = [];
let page = 1;
const pageSize = 10;
let filtro = "";
let cuentaId = null;

// =================== UTILS ===================
function formatDate(v) {
    try {
        const dt = v?.toDate ? v.toDate() : (v ? new Date(v) : null);
        if (!dt) return "";
        return dt.toLocaleString("es-MX", {
            dateStyle: "short",
            timeStyle: "short",
        });
    } catch {
        return "";
    }
}

// =================== PAGINACIÓN Y RENDER ===================
function renderTabla() {
    const data = subcuentas.filter((r) =>
        (r.nombre || "").toLowerCase().includes(filtro) ||
        (r.usuario || "").toLowerCase().includes(filtro)
    );

    const total = data.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (page > totalPages) page = totalPages;
    const start = (page - 1) * pageSize;
    const slice = data.slice(start, start + pageSize);

    tabla.innerHTML = slice.map((r, idx) => `
    <tr>
        <td>${start + idx + 1}</td>
        <td><a href="${r.url}" target="_blank">${r.url}</a></td>
        <td>${r.usuario || '-'}</td>
        <td>${r.fechaRegistro || '-'}</td>
        <td>${r.fechaCambio || '-'}</td>
        <td class="text-center">
        <a href="/subcuentas.html?id=${r.id}" class="btn btn-outline-primary btn-sm">
            <i class="bi bi-people"></i> Ver
        </a>
        </td>
        <td class="text-nowrap">
        <button class="btn btn-sm btn-outline-primary" data-id="${r.id}" data-action="edit">
            <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" data-id="${r.id}" data-action="delete">
            <i class="bi bi-trash"></i>
        </button>
        </td>
    </tr>
`).join('');


    infoPaginacionEl.textContent = `${total === 0 ? 0 : start + 1}-${Math.min(start + pageSize, total)} de ${total}`;

    // Render paginación
    paginacionEl.innerHTML = "";
    const maxPages = Math.ceil(total / pageSize) || 1;
    for (let i = 1; i <= maxPages; i++) {
        const li = document.createElement("li");
        li.className = `page-item ${i === page ? "active" : ""}`;
        li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        li.onclick = (e) => {
            e.preventDefault();
            page = i;
            renderTabla();
        };
        paginacionEl.appendChild(li);
    }
}
// --- Actualizar resumen de cards ---
function actualizarCards() {
    const total = subcuentas.length;
    const activas = subcuentas.filter(s => s.estatus === "Activo").length;
    const suspendidas = subcuentas.filter(s => s.estatus === "Suspendido").length;

    document.getElementById("totalSubcuentas").textContent = total;
    document.getElementById("subcuentasActivas").textContent = activas;
    document.getElementById("subcuentasSuspendidas").textContent = suspendidas;
}

// =================== CARGA DE DATOS ===================
async function cargarSubcuentas() {
    try {
        if (!cuentaId) return;
        tabla.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">Cargando registros...</td></tr>`;

        const ref = collection(db, "resguardo_contrasenas", cuentaId, "subcuentas");
        const snap = await getDocs(ref);

        subcuentas = [];
        snap.forEach((docSnap) => {
            const d = docSnap.data();
            subcuentas.push({
                id: docSnap.id,
                nombre: d.nombre || "",
                correo: d.correo || "",
                telefono: d.telefono || "",
                usuario: d.usuario || "",
                estatus: d.estatus || "",
                rol: d.rol || "",
                fechaRegistro: d.fechaRegistro || null,
                fechaCambio: d.fechaCambio || null,
            });
        });

        renderTabla();
        actualizarCards();

    } catch (err) {
        console.error("❌ Error al cargar subcuentas:", err);
        tabla.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error al cargar.</td></tr>`;
    }
}

// =================== CARGAR NOMBRE CUENTA ===================
async function cargarNombreCuenta() {
    try {
        if (!cuentaId) return;
        const ref = doc(db, "resguardo_contrasenas", cuentaId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const data = snap.data();
            nombreCuentaEl.textContent = data.url || "(Cuenta sin nombre)";
        } else {
            nombreCuentaEl.textContent = "(Cuenta no encontrada)";
        }
    } catch (err) {
        console.error("❌ Error al obtener nombre de cuenta:", err);
    }
}

// =================== BUSCADOR ===================
buscar?.addEventListener("input", (e) => {
    filtro = (e.target.value || "").toLowerCase();
    page = 1;
    renderTabla();
});

// =================== MODAL NUEVA/EDITAR ===================
modalSubcuentaEl?.addEventListener("show.bs.modal", (e) => {
    const trigger = e.relatedTarget;
    if (trigger && trigger.id === "btnNuevaSubcuenta") {
        subcuentaIdInput.value = "";
        formSubcuenta.reset();
    }
});

formSubcuenta?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
        const id = subcuentaIdInput.value;
        const payload = {
            nombre: document.getElementById("sNombre").value.trim(),
            correo: document.getElementById("sCorreo").value.trim(),
            telefono: document.getElementById("sTelefono").value.trim(),
            usuario: document.getElementById("sUsuario").value.trim(),
            rol: document.getElementById("sRol").value.trim(),
            estatus: document.getElementById("sEstatus").value.trim(),
            fechaCambio: serverTimestamp(),
        };

        if (!cuentaId) {
            Swal.fire("Error", "No se encontró el ID de la cuenta principal.", "error");
            return;
        }

        if (id) {
            await updateDoc(doc(db, "resguardo_contrasenas", cuentaId, "subcuentas", id), payload);
            Swal.fire("Actualizada", "Subcuenta actualizada correctamente.", "success");
        } else {
            await addDoc(collection(db, "resguardo_contrasenas", cuentaId, "subcuentas"), {
                ...payload,
                fechaRegistro: serverTimestamp(),
            });
            Swal.fire("Agregada", "Subcuenta agregada correctamente.", "success");
        }

        formSubcuenta.reset();
        subcuentaIdInput.value = "";
        modalSubcuenta?.hide();
        await cargarSubcuentas();
    } catch (err) {
        console.error("❌ Error al guardar subcuenta:", err);
        Swal.fire("Error", "No se pudo guardar la subcuenta.", "error");
    }
});

// =================== EDITAR / ELIMINAR ===================
tabla?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;

    // Editar
    if (action === "edit") {
        try {
            const ref = doc(db, "resguardo_contrasenas", cuentaId, "subcuentas", id);
            const snap = await getDoc(ref);
            if (!snap.exists()) {
                Swal.fire("Error", "No se encontró la subcuenta.", "error");
                return;
            }
            const d = snap.data();

            subcuentaIdInput.value = id;
            document.getElementById("sNombre").value = d.nombre || "";
            document.getElementById("sCorreo").value = d.correo || "";
            document.getElementById("sTelefono").value = d.telefono || "";
            document.getElementById("sUsuario").value = d.usuario || "";
            document.getElementById("sRol").value = d.rol || "QA";
            document.getElementById("sEstatus").value = d.estatus || "Activo";

            modalSubcuenta?.show();
        } catch (err) {
            console.error("❌ Error al cargar subcuenta:", err);
            Swal.fire("Error", "No se pudo cargar la subcuenta.", "error");
        }
    }

    // Eliminar
    if (action === "delete") {
        const confirm = await Swal.fire({
            title: "¿Eliminar subcuenta?",
            text: "Esta acción no se puede deshacer.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Eliminar",
            cancelButtonText: "Cancelar",
        });
        if (confirm.isConfirmed) {
            try {
                await deleteDoc(doc(db, "resguardo_contrasenas", cuentaId, "subcuentas", id));
                Swal.fire("Eliminada", "Subcuenta eliminada correctamente.", "success");
                await cargarSubcuentas();
            } catch (err) {
                console.error("❌ Error al eliminar:", err);
                Swal.fire("Error", "No se pudo eliminar la subcuenta.", "error");
            }
        }
    }
});

// =================== EXPORTAR EXCEL ===================
document.getElementById("btnExportarExcel")?.addEventListener("click", async () => {
    try {
        Swal.fire({ title: "Generando Excel...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const snap = await getDocs(collection(db, "resguardo_contrasenas", cuentaId, "subcuentas"));
        const registros = [];
        snap.forEach((docSnap) => {
            const d = docSnap.data();
            registros.push({
                Nombre: d.nombre || "",
                Correo: d.correo || "",
                Teléfono: d.telefono || "",
                Usuario: d.usuario || "",
                Rol: d.rol || "",
                Estatus: d.estatus || "",
                "Fecha registro": formatDate(d.fechaRegistro),
                "Fecha cambio": formatDate(d.fechaCambio),
            });
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(registros);
        XLSX.utils.book_append_sheet(wb, ws, "Subcuentas");
        XLSX.writeFile(wb, "Subcuentas.xlsx");

        Swal.close();
        Swal.fire("Descargado", "Archivo Excel generado correctamente.", "success");
    } catch (err) {
        console.error("❌ Error exportando:", err);
        Swal.fire("Error", "No se pudo exportar el Excel.", "error");
    }
});

// =================== SESIÓN Y ARRANQUE ===================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        Swal.fire({ icon: "warning", title: "Sesión expirada", text: "Por favor inicia sesión nuevamente." })
            .then(() => (location.href = "/index.html"));
    } else {
        const params = new URLSearchParams(window.location.search);
        cuentaId = params.get("id");
        if (!cuentaId) {
            Swal.fire("Error", "No se encontró el ID de la cuenta principal.", "error");
            return;
        }
        await cargarNombreCuenta();
        await cargarSubcuentas();
    }
});
