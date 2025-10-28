import { db } from "./firebase-config.js";
import { collection, addDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// --- Datos de prueba ---
const data = [
  {
    folioCC: "CC-27OCT",
    solicitante: "Elihu",
    uid: "uid-1",
    fecha: new Date("2025-10-27T18:12:47-06:00"),
    fechaCambio: new Date("2025-11-02T05:22:19-06:00"),
    revision: "Wenceslao",
    celulaTI: "Web Banking",
    tipo: "Bugfix",
    estatusCC: "Pendiente",
    folios: [
      {
        folioCC: "CC-27OCT",
        folio: "F-001",
        revision: "Wenceslao",
        celulaTI: "Web Banking",
        tipo: "Bugfix",
        estatus: "Pendiente",
        categoriaCambio: "Incidencia",
        riesgo: "Alto",
        impacto: "Medio",
        afectaProduccion: true,
        tieneLogs: true,
        requiereMonitoreoGrafana: false,
        requiereMonitoreoZabbix: true,
        componentes: "Módulo de transferencias SPEI",
        duracionActividad: "30 min",
        tiempoAfectacionOperativa: "10 min",
        team: "QA Finsus",
        estatusControlCambios: "Pendiente",
        documentacionFolioCC: "https://finsusdocs.example.com/cc-27oct-f001"
      },
      {
        folioCC: "CC-27OCT",
        folio: "F-002",
        revision: "Wenceslao",
        celulaTI: "Web Banking",
        tipo: "Bugfix",
        estatus: "Cerrado",
        categoriaCambio: "Requerimiento",
        riesgo: "Medio",
        impacto: "Bajo",
        afectaProduccion: false,
        tieneLogs: false,
        requiereMonitoreoGrafana: true,
        requiereMonitoreoZabbix: true,
        componentes: "Frontend de login web",
        duracionActividad: "15 min",
        tiempoAfectacionOperativa: "0 min",
        team: "Core Devs",
        estatusControlCambios: "Cerrado",
        documentacionFolioCC: "https://finsusdocs.example.com/cc-27oct-f002"
      }
    ]
  },
  {
    folioCC: "CC-28OCT",
    solicitante: "Daniel",
    uid: "uid-2",
    fecha: new Date("2025-10-28T10:30:00-06:00"),
    fechaCambio: new Date("2025-11-03T02:00:00-06:00"),
    revision: "Arturo",
    celulaTI: "App Finsus/Core",
    tipo: "REQ +",
    estatusCC: "Pendiente",
    folios: [
      {
        folioCC: "CC-28OCT",
        folio: "F-003",
        revision: "Arturo",
        celulaTI: "App Finsus/Core",
        tipo: "REQ +",
        estatus: "Pendiente",
        categoriaCambio: "Requerimiento",
        riesgo: "Bajo",
        impacto: "Bajo",
        afectaProduccion: false,
        tieneLogs: true,
        requiereMonitoreoGrafana: false,
        requiereMonitoreoZabbix: false,
        componentes: "Pantalla de movimientos recientes",
        duracionActividad: "20 min",
        tiempoAfectacionOperativa: "0 min",
        team: "Frontend App",
        estatusControlCambios: "Pendiente",
        documentacionFolioCC: "https://finsusdocs.example.com/cc-28oct-f003"
      },
      {
        folioCC: "CC-28OCT",
        folio: "F-004",
        revision: "Arturo",
        celulaTI: "App Finsus/Core",
        tipo: "REQ +",
        estatus: "Cerrado",
        categoriaCambio: "Liberacion",
        riesgo: "Medio",
        impacto: "Medio",
        afectaProduccion: true,
        tieneLogs: true,
        requiereMonitoreoGrafana: true,
        requiereMonitoreoZabbix: true,
        componentes: "API de registro de usuarios",
        duracionActividad: "40 min",
        tiempoAfectacionOperativa: "5 min",
        team: "Backend Core",
        estatusControlCambios: "Cerrado",
        documentacionFolioCC: "https://finsusdocs.example.com/cc-28oct-f004"
      }
    ]
  }
];

// --- Inserción automática ---
async function poblarDatos() {
  for (const cc of data) {
    // Crear el documento principal
    const ccRef = await addDoc(collection(db, "nuevoCC"), {
      folioCC: cc.folioCC,
      solicitante: cc.solicitante,
      uid: cc.uid,
      fecha: cc.fecha,
      fechaCambio: cc.fechaCambio,
      revision: cc.revision,
      celulaTI: cc.celulaTI,
      tipo: cc.tipo,
      estatusCC: cc.estatusCC
    });

    console.log(`✅ CC creado: ${cc.folioCC} (ID: ${ccRef.id})`);

    // Insertar folios en la subcolección
    for (const folio of cc.folios) {
      await addDoc(collection(db, "nuevoCC", ccRef.id, "folios"), folio);
      console.log(`   ↳ Folio agregado: ${folio.folio}`);
    }
  }
  console.log("🎉 Carga de datos de prueba completada correctamente");
}

poblarDatos();
