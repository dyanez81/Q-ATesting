import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// 🧹 Eliminar TODAS las apps y sus subniveles
async function eliminarColeccionRecursiva(coleccionRef) {
  const snap = await getDocs(coleccionRef);
  for (const documento of snap.docs) {
    const subcolecciones = ["modulos", "matrices", "casos", "bugs"];
    for (const sub of subcolecciones) {
      const subRef = collection(documento.ref, sub);
      const subSnap = await getDocs(subRef);
      if (!subSnap.empty) {
        await eliminarColeccionRecursiva(subRef);
      }
    }
    await deleteDoc(documento.ref);
  }
}

// 🚀 Crear datos de ejemplo
async function crearDatosDemo() {
  try {
    console.log("🧹 Eliminando apps existentes...");
    await eliminarColeccionRecursiva(collection(db, "apps"));
    console.log("✅ Apps anteriores eliminadas.");

    // ================================
    // 🔷 APP 1 - Finsus QA
    // ================================
    const app1Ref = doc(collection(db, "apps"));
    await setDoc(app1Ref, {
      nombre: "Finsus QA",
      tipo: "Móvil",
      estatus: true,
      fechaFin: new Date("2025-12-31"),
      requerimiento: "Validación de transferencias SPEI",
      tester: "daniel@finsus.mx",
      testerNombre: "Daniel Yañez",
      testerUid: "uid_tester_001",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // --- Módulo 1 ---
    const mod1Ref = doc(collection(app1Ref, "modulos"));
    await setDoc(mod1Ref, {
      nombre: "Transferencias",
      ambiente: "QA",
      submodulo: "SPEI",
      fechaInicio: new Date("2025-10-15"),
    });

    // --- Matriz 1.1 ---
    const mat1Ref = doc(collection(mod1Ref, "matrices"));
    await setDoc(mat1Ref, {
      nombre: "Matriz SPEI QA",
      descripcion: "Cobertura funcional del flujo SPEI.",
      ambiente: "QA",
      createdAt: serverTimestamp(),
    });

    const caso1Ref = doc(collection(mat1Ref, "casos"));
    await setDoc(caso1Ref, {
      NombreDelCaso: "Validar transferencia SPEI exitosa",
      Descripcion: "Verifica procesamiento correcto de transferencia SPEI.",
      TipoDePrueba: "Funcional",
      Estado: "Positivo",
      Tester: "daniel@finsus.mx",
      ReferenciaHU: "HU-TRX-001",
      createdAt: serverTimestamp(),
    });

    await setDoc(doc(collection(caso1Ref, "bugs")), {
      nombre: "Error menor en validación de monto",
      descripcion: "El monto se muestra con un decimal adicional.",
      estado: "Abierto",
      tester: "uid_tester_001",
      desarrollador: "uid_dev_001",
      evidenciaUrl: "https://storage.googleapis.com/finsus-bucket/bugs/monto.png",
      comentariosTester: "No afecta el flujo principal.",
      fechaReporte: serverTimestamp(),
    });

    const caso2Ref = doc(collection(mat1Ref, "casos"));
    await setDoc(caso2Ref, {
      NombreDelCaso: "Validar SPEI con CLABE inválida",
      Descripcion: "Debe mostrar error al ingresar CLABE errónea.",
      TipoDePrueba: "Negativa",
      Estado: "Fallo",
      Tester: "tester@finsus.mx",
      ReferenciaHU: "HU-TRX-002",
      createdAt: serverTimestamp(),
    });

    await setDoc(doc(collection(caso2Ref, "bugs")), {
      nombre: "Validación CLABE fallida",
      descripcion: "No se muestra mensaje de error con CLABE incorrecta.",
      estado: "Abierto",
      tester: "uid_tester_002",
      desarrollador: "uid_dev_002",
      evidenciaUrl: "https://storage.googleapis.com/finsus-bucket/bugs/clabe.png",
      comentariosTester: "Pendiente de revisión backend.",
      fechaReporte: serverTimestamp(),
    });

    // --- Matriz 1.2 ---
    const mat2Ref = doc(collection(mod1Ref, "matrices"));
    await setDoc(mat2Ref, {
      nombre: "Matriz SPEI Negativa",
      descripcion: "Validación de límites de monto.",
      ambiente: "QA",
      createdAt: serverTimestamp(),
    });

    const caso3Ref = doc(collection(mat2Ref, "casos"));
    await setDoc(caso3Ref, {
      NombreDelCaso: "Validar SPEI con monto excedido",
      TipoDePrueba: "Negativa",
      Estado: "Pendiente",
      Tester: "qa@finsus.mx",
      ReferenciaHU: "HU-TRX-003",
      createdAt: serverTimestamp(),
    });

    await setDoc(doc(collection(caso3Ref, "bugs")), {
      nombre: "Validación de monto no aplicada",
      descripcion: "Permite monto superior al límite.",
      estado: "Abierto",
      tester: "uid_tester_003",
      desarrollador: "uid_dev_004",
      evidenciaUrl: "https://storage.googleapis.com/finsus-bucket/bugs/monto_limite.png",
      comentariosTester: "Requiere control en backend.",
      fechaReporte: serverTimestamp(),
    });

    // ================================
    // 🔶 APP 2 - Finsus Créditos
    // ================================
    const app2Ref = doc(collection(db, "apps"));
    await setDoc(app2Ref, {
      nombre: "Finsus Créditos",
      tipo: "Web",
      estatus: true,
      fechaFin: new Date("2025-11-30"),
      requerimiento: "Validación del flujo de solicitud de crédito",
      tester: "luis@finsus.mx",
      testerNombre: "Luis García",
      testerUid: "uid_tester_002",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const mod2Ref = doc(collection(app2Ref, "modulos"));
    await setDoc(mod2Ref, {
      nombre: "Créditos",
      ambiente: "QA",
      submodulo: "Tarjetas",
      fechaInicio: new Date("2025-09-10"),
    });

    const mat3Ref = doc(collection(mod2Ref, "matrices"));
    await setDoc(mat3Ref, {
      nombre: "Matriz Créditos QA",
      descripcion: "Casos de prueba para tarjetas de crédito.",
      ambiente: "QA",
      createdAt: serverTimestamp(),
    });

    const caso4Ref = doc(collection(mat3Ref, "casos"));
    await setDoc(caso4Ref, {
      NombreDelCaso: "Solicitud de tarjeta básica",
      TipoDePrueba: "Funcional",
      Estado: "Positivo",
      Tester: "luis@finsus.mx",
      ReferenciaHU: "HU-CRD-001",
      createdAt: serverTimestamp(),
    });

    await setDoc(doc(collection(caso4Ref, "bugs")), {
      nombre: "Error en dirección de usuario",
      descripcion: "Dirección incompleta al crear solicitud.",
      estado: "Abierto",
      tester: "uid_tester_004",
      desarrollador: "uid_dev_005",
      evidenciaUrl: "https://storage.googleapis.com/finsus-bucket/bugs/credit_address.png",
      comentariosTester: "Detectado en etapa de QA.",
      fechaReporte: serverTimestamp(),
    });

    console.log("✅ Datos demo creados correctamente en Firestore jerárquico (apps/modulos/matrices/casos/bugs)");
  } catch (err) {
    console.error("❌ Error creando datos de demo:", err);
  }
}

crearDatosDemo();
