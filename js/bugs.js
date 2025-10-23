// /js/bugs.js
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { db, auth, storage } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

let tabla, form, modalEl, modal;
let currentUser = null;
let bugs = [];

// Esperar a que el DOM esté listo antes de inicializar
document.addEventListener("DOMContentLoaded", () => {
    tabla = document.querySelector("#tablaBugs tbody");
    form = document.getElementById("formBug");
    modalEl = document.getElementById("modalBug");
    modal = modalEl ? new bootstrap.Modal(modalEl) : null;

    if (modalEl) {
        modalEl.addEventListener("hidden.bs.modal", limpiarFormulario);
    }

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            Swal.fire({
                icon: "warning",
                title: "Sesión expirada",
                text: "Por favor inicia sesión nuevamente.",
                confirmButtonColor: "#23223F",
            }).then(() => (window.location.href = "index.html"));
            return;
        }

        currentUser = user;
        await cargarBugs();
    });
});

// --- Cargar todos los bugs ---
async function cargarBugs() {
    const querySnapshot = await getDocs(collection(db, "bugs"));
    bugs = [];
    if (tabla) tabla.innerHTML = "";
    let i = 1;

    querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        bugs.push({ id: docSnap.id, ...data });

        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${i++}</td>
      <td>${data.titulo || "Sin título"}</td>
      <td><span class="badge bg-${colorPrioridad(data.prioridad)}">${data.prioridad || "-"}</span></td>
      <td><span class="badge bg-${colorEstado(data.estatus)}">${data.estatus || "-"}</span></td>
      <td>${data.reportadoPor || "-"}</td>
      <td>${formatearFecha(data.fechaCreacion)}</td>
      <td>${botonesAcciones(data, docSnap.id)}</td>
    `;
        tabla.appendChild(tr);
    });
}

// --- Colores dinámicos ---
function colorPrioridad(p) {
    return p === "Alta"
        ? "danger"
        : p === "Media"
            ? "warning text-dark"
            : "secondary";
}
function colorEstado(e) {
    return e === "Abierto"
        ? "danger"
        : e === "En revisión"
            ? "warning text-dark"
            : e === "Resuelto"
                ? "success"
                : "secondary";
}

// --- Formatear fecha ---
function formatearFecha(ts) {
    if (!ts) return "-";
    const d = ts.toDate();
    return d.toLocaleDateString("es-MX") + " " + d.toLocaleTimeString("es-MX");
}

// --- Acciones ---
function botonesAcciones(data, id) {
    let html = `
    <button class="btn btn-sm btn-outline-info me-2" onclick="verDetalleBug('${id}')">
      <i class="bi bi-eye"></i>
    </button>
  `;

    if (data.estatus !== "Cerrado" && currentUser?.email === data.reportadoPor) {
        html += `<button class="btn btn-sm btn-outline-success me-2" onclick="validarBug('${id}')">
               <i class="bi bi-check2-circle"></i>
             </button>`;
    }

    html += `<button class="btn btn-sm btn-outline-primary" onclick="editarBug('${id}')">
             <i class="bi bi-pencil"></i>
           </button>`;
    return html;
}

// --- Crear / Editar ---
if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = document.getElementById("bugId").value;
        const titulo = document.getElementById("bugTitulo").value.trim();
        const prioridad = document.getElementById("bugPrioridad").value;
        const descripcion = document.getElementById("bugDescripcion").value.trim();
        const estatus = document.getElementById("bugEstado").value;

        try {
            if (id) {
                await updateDoc(doc(db, "bugs", id), { titulo, prioridad, descripcion, estatus });
                Swal.fire("Actualizado", "El bug fue actualizado correctamente.", "success");
            } else {
                await addDoc(collection(db, "bugs"), {
                    titulo,
                    prioridad,
                    descripcion,
                    estatus,
                    reportadoPor: currentUser.email,
                    fechaCreacion: serverTimestamp(),
                });
                Swal.fire("Registrado", "El bug fue creado correctamente.", "success");
            }
            limpiarFormulario();
            modal.hide();
            cargarBugs();
        } catch (error) {
            console.error(error);
            Swal.fire("Error", "No se pudo guardar el bug", "error");
        }
    });
}

// --- Editar bug ---
window.editarBug = (id) => {
    const bug = bugs.find((b) => b.id === id);
    if (!bug) return;
    limpiarFormulario();
    document.getElementById("bugId").value = bug.id;
    document.getElementById("bugTitulo").value = bug.titulo;
    document.getElementById("bugPrioridad").value = bug.prioridad;
    document.getElementById("bugDescripcion").value = bug.descripcion;
    document.getElementById("bugEstado").value = bug.estatus;
    modal.show();
};

// --- Validar bug ---
window.validarBug = async (id) => {
    const { value: file } = await Swal.fire({
        title: "Validar Bug",
        text: "Sube una evidencia de la corrección.",
        input: "file",
        inputAttributes: { accept: ".png,.jpg,.jpeg,.pdf" },
        showCancelButton: true,
        confirmButtonText: "Subir y cerrar",
        confirmButtonColor: "#23223F",
    });

    if (file) {
        try {
            const storagePath = `evidencias_bugs/${id}_${file.name}`;
            const storageRef = ref(storage, storagePath);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            await updateDoc(doc(db, "bugs", id), {
                estatus: "Cerrado",
                evidenciaValidacion: url,
                fechaCierre: serverTimestamp(),
            });
            Swal.fire("Validado", "El bug se ha marcado como corregido.", "success");
            cargarBugs();
        } catch (err) {
            console.error(err);
            Swal.fire("Error", "No se pudo subir la evidencia", "error");
        }
    }
};

// --- Ver detalle del bug ---
window.verDetalleBug = (id) => {
    const bug = bugs.find((b) => b.id === id);
    if (!bug) return;

    const modalDetalle = new bootstrap.Modal(document.getElementById("modalDetalleBug"));
    document.getElementById("detalleTitulo").textContent = bug.titulo || "Sin título";
    document.getElementById("detallePrioridad").textContent = bug.prioridad || "-";
    document.getElementById("detalleEstado").textContent = bug.estatus || "-";
    document.getElementById("detalleDescripcion").textContent = bug.descripcion || "Sin descripción";
    document.getElementById("detalleReportadoPor").textContent = bug.reportadoPor || "-";
    document.getElementById("detalleFecha").textContent = bug.fechaCreacion ? formatearFecha(bug.fechaCreacion) : "-";

    const evidencia = document.getElementById("detalleEvidencia");
    if (bug.evidenciaValidacion) {
        const ext = bug.evidenciaValidacion.split(".").pop().toLowerCase();
        if (["png", "jpg", "jpeg"].includes(ext)) {
            evidencia.innerHTML = `<img src="${bug.evidenciaValidacion}" class="img-fluid rounded shadow-sm" alt="Evidencia">`;
        } else if (ext === "pdf") {
            evidencia.innerHTML = `<a href="${bug.evidenciaValidacion}" target="_blank" class="btn btn-outline-primary">
        <i class="bi bi-file-earmark-pdf"></i> Ver PDF
      </a>`;
        }
    } else {
        evidencia.innerHTML = `<p class="text-muted">No hay evidencia adjunta.</p>`;
    }
    modalDetalle.show();
};

// --- Limpiar formulario ---
function limpiarFormulario() {
    if (form) {
        form.reset();
        document.getElementById("bugId").value = "";
    }
}
