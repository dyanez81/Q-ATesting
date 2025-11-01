import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  addDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import jsPDF from "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
import html2canvas from "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  Media,
  HeadingLevel,
} from "https://cdn.jsdelivr.net/npm/docx@8.0.1/+esm";

const params = new URLSearchParams(window.location.search);
const appId = params.get("appId");
const reqId = params.get("reqId");

const infoReq = document.getElementById("infoRequerimiento");
const tablaCasos = document.getElementById("tablaCasos").querySelector("tbody");
const btnNuevoCaso = document.getElementById("btnNuevoCaso");
const btnVolver = document.getElementById("btnVolver");
const btnExportarPDF = document.getElementById("btnExportarPDF");
const btnExportarWord = document.getElementById("btnExportarWord");

let requerimientoData = {};
let casosData = [];

// ==========================================================
// 🔹 Cargar información del requerimiento
// ==========================================================
async function cargarRequerimiento() {
  const ref = doc(db, `apps/${appId}/requerimientos/${reqId}`);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    requerimientoData = snap.data();
    infoReq.innerHTML = `
      <h5 class="fw-bold text-primary mb-2">Requerimiento ${requerimientoData.folio}</h5>
      <p><strong>Descripción:</strong> ${requerimientoData.descripcion || "-"}</p>
      <p><strong>Tester:</strong> ${requerimientoData.testerNombre || "-"}</p>
      <p><strong>Estado:</strong> ${requerimientoData.estado || "-"}</p>
    `;
  }
}

// ==========================================================
// 🔹 Cargar casos de mini matriz
// ==========================================================
async function cargarCasos() {
  tablaCasos.innerHTML = `<tr><td colspan="6" class="text-center">Cargando...</td></tr>`;
  const ref = collection(db, `apps/${appId}/requerimientos/${reqId}/miniMatrices`);
  const snap = await getDocs(ref);

  tablaCasos.innerHTML = "";
  casosData = [];
  let i = 1;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    casosData.push(data);
    tablaCasos.insertAdjacentHTML(
      "beforeend",
      `
      <tr>
        <td>${i++}</td>
        <td>${data.nombreCaso}</td>
        <td>${data.descripcion}</td>
        <td>${data.resultado}</td>
        <td>${data.evidenciaUrl ? `<a href="${data.evidenciaUrl}" target="_blank">Ver evidencia</a>` : "-"}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary me-2" data-id="${docSnap.id}" data-action="editar">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" data-id="${docSnap.id}" data-action="eliminar">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>`
    );
  }
}

// ==========================================================
// 🔹 Agregar nuevo caso
// ==========================================================
btnNuevoCaso.addEventListener("click", async () => {
  const { value: formValues } = await Swal.fire({
    title: "Nuevo Caso de Prueba",
    html: `
      <input id="nombreCaso" class="swal2-input" placeholder="Nombre del caso">
      <textarea id="descripcion" class="swal2-textarea" placeholder="Descripción"></textarea>
      <input id="resultado" class="swal2-input" placeholder="Resultado obtenido">
      <input id="evidenciaUrl" class="swal2-input" placeholder="URL de evidencia (opcional)">
    `,
    preConfirm: () => ({
      nombreCaso: document.getElementById("nombreCaso").value,
      descripcion: document.getElementById("descripcion").value,
      resultado: document.getElementById("resultado").value,
      evidenciaUrl: document.getElementById("evidenciaUrl").value,
    }),
  });

  if (formValues) {
    const ref = collection(db, `apps/${appId}/requerimientos/${reqId}/miniMatrices`);
    await addDoc(ref, {
      ...formValues,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    Swal.fire("✅ Guardado", "Caso agregado correctamente", "success");
    cargarCasos();
  }
});

// ==========================================================
// 🔹 Acciones de tabla
// ==========================================================
tablaCasos.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  const ref = doc(db, `apps/${appId}/requerimientos/${reqId}/miniMatrices/${id}`);

  if (action === "editar") {
    const snap = await getDoc(ref);
    const data = snap.data();
    const { value: formValues } = await Swal.fire({
      title: "Editar Caso",
      html: `
        <input id="nombreCaso" class="swal2-input" value="${data.nombreCaso}">
        <textarea id="descripcion" class="swal2-textarea">${data.descripcion}</textarea>
        <input id="resultado" class="swal2-input" value="${data.resultado}">
        <input id="evidenciaUrl" class="swal2-input" value="${data.evidenciaUrl || ""}">
      `,
      preConfirm: () => ({
        nombreCaso: document.getElementById("nombreCaso").value,
        descripcion: document.getElementById("descripcion").value,
        resultado: document.getElementById("resultado").value,
        evidenciaUrl: document.getElementById("evidenciaUrl").value,
      }),
    });

    if (formValues) {
      await updateDoc(ref, { ...formValues, updatedAt: serverTimestamp() });
      Swal.fire("✅ Actualizado", "El caso fue actualizado correctamente", "success");
      cargarCasos();
    }
  }

  if (action === "eliminar") {
    Swal.fire({
      icon: "warning",
      title: "¿Eliminar caso?",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
    }).then(async (res) => {
      if (res.isConfirmed) {
        await deleteDoc(ref);
        Swal.fire("🗑️ Eliminado", "El caso fue eliminado", "success");
        cargarCasos();
      }
    });
  }
});

// ==========================================================
// 🔹 Exportar Word con imágenes embebidas
// ==========================================================
btnExportarWord.addEventListener("click", async () => {
  const docSections = [
    new Paragraph({ text: "Mini Matriz de Pruebas - QA Finsus", heading: HeadingLevel.HEADING_1 }),
    new Paragraph(`Requerimiento: ${requerimientoData.folio || "-"}`),
    new Paragraph(`Tester: ${requerimientoData.testerNombre || "-"}`),
    new Paragraph(`Estado: ${requerimientoData.estado || "-"}`),
    new Paragraph(`Descripción: ${requerimientoData.descripcion || "-"}`),
    new Paragraph(" "),
  ];

  // Tabla de casos
  const tableRows = [
    new TableRow({
      children: ["#", "Nombre", "Descripción", "Resultado"].map(
        (text) => new TableCell({ children: [new Paragraph({ text, bold: true })] })
      ),
    }),
    ...casosData.map(
      (c, i) =>
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(String(i + 1))] }),
            new TableCell({ children: [new Paragraph(c.nombreCaso)] }),
            new TableCell({ children: [new Paragraph(c.descripcion)] }),
            new TableCell({ children: [new Paragraph(c.resultado)] }),
          ],
        })
    ),
  ];

  docSections.push(new Table({ rows: tableRows }));
  docSections.push(new Paragraph(" "));
  docSections.push(new Paragraph({ text: "📸 Evidencias", heading: HeadingLevel.HEADING_2 }));

  // Insertar evidencias como imágenes
  for (const c of casosData) {
    if (c.evidenciaUrl) {
      try {
        const res = await fetch(c.evidenciaUrl);
        const blob = await res.blob();
        const img = await Media.addImage(
          new Document(),
          await blob.arrayBuffer(),
          500,
          300
        );
        docSections.push(new Paragraph({ children: [new TextRun(c.nombreCaso), img] }));
      } catch {
        docSections.push(new Paragraph(`${c.nombreCaso}: (Evidencia no disponible)`));
      }
    }
  }

  const doc = new Document({ sections: [{ children: docSections }] });
  const blob = await Packer.toBlob(doc);
  const fileName = `MiniMatriz_QA_Finsus_${requerimientoData.folio || "sin-folio"}.docx`;
  saveAs(blob, fileName);
  Swal.fire("📄 Exportado", "Archivo Word generado con evidencias embebidas", "success");
});

// ==========================================================
// 🔹 Exportar PDF
// ==========================================================
btnExportarPDF.addEventListener("click", async () => {
  const element = document.querySelector(".main-content");
  const canvas = await html2canvas(element);
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  pdf.addImage(imgData, "PNG", 20, 20, 555, 780);
  pdf.save(`MiniMatriz_QA_Finsus_${requerimientoData.folio || "sin-folio"}.pdf`);
});

// ==========================================================
// 🔹 Volver a requerimientos
// ==========================================================
btnVolver.addEventListener("click", () => {
  window.location.href = `requerimientos.html?appId=${appId}`;
});

// ==========================================================
cargarRequerimiento();
cargarCasos();
