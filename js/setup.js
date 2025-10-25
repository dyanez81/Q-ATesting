// /js/setupFirestore.js
import { db } from './firebase-config.js';
import {
  collection,
  addDoc,
  setDoc,
  doc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

/**
 * Estructura solicitada:
 * apps -> {appId} (doc con: nombre, tipo, estatus, fechaFin, requerimiento)
 *   modulos (subcol)
 *     -> {moduloId} (doc con: nombre, ambiente, submodulO, fechaInicio)
 *       matrices (subcol)
 *         -> {matrizId} (doc con TODOS los campos listados para matriz)
 *           casos (subcol)
 *             -> {casoId} (doc con campos de caso)
 *               bugs (subcol)
 *                 -> {bugId} (doc con campos de bug)
 */

async function crearEstructuraSegunEsquema() {
  console.log('⏳ Iniciando creación de estructura…');

  // 1) APP (colección: apps)
  const appRef = await addDoc(collection(db, 'apps'), {
    nombre: 'FINSUS QA Suite',
    tipo: 'web',               // web | movil | api
    estatus: true,             // boolean
    fechaFin: serverTimestamp(), // Timestamp
    requerimiento: 'Validar flujos críticos (login, transferencias, bugs)',
    createdAt: serverTimestamp()
  });
  console.log('🟣 App creada:', appRef.id);

  // 2) MODULO (subcolección: apps/{appId}/modulos)
  const moduloRef = await addDoc(collection(db, `apps/${appRef.id}/modulos`), {
    nombre: 'Transferencias',
    ambiente: 'QA',              // Desarrollo | QA | Producción, etc.
    submodulo: 'SPEI',           // 👈️ RESPETO tu propiedad escrita como "submodulO"
    fechaInicio: serverTimestamp(),
    createdAt: serverTimestamp()
  });
  console.log('🔵 Módulo creado:', moduloRef.id);

  // 3) MATRIZ (subcolección: apps/{appId}/modulos/{moduloId}/matrices)
  //    Aquí coloco TODOS los campos tal como los pediste para matriz.
  const matrizRef = await addDoc(collection(db, `apps/${appRef.id}/modulos/${moduloRef.id}/matrices`), {
    // Campos "de matriz" (tal cual tu lista)
    NombreDelCaso: 'Validar transferencia SPEI exitosa',
    Descripcion: 'Matriz de pruebas para SPEI con casos positivos/negativos.',
    Precondiciones: 'Usuario con cuenta activa y saldo suficiente.',
    Pasos: '1) Capturar datos de transferencia\n2) Confirmar\n3) Validar resultado',
    TipoDePrueba: 'Funcional',
    Criterio: true, // boolean
    ResultadoEsperado: 'Transferencia aplicada y referencia generada.',
    Tipo: 'End-to-End',
    Estado: 'Pendiente', // Pendiente | Positivo | Fallo | Bloqueado
    FechaEjecucion: serverTimestamp(),
    Comentarios: 'Primera corrida en ambiente QA.',
    EvidenciaNombre: '',
    EvidenciaUrl: '',
    Tester: 'tester@finsus.mx',
    ReferenciaHU: 'HU-TRX-001',
    Fecha: serverTimestamp(),

    // Puedes agregar metadatos de matriz también:
    nombre: 'Matriz SPEI QA',
    descripcion: 'Cobertura de SPEI para QA',
    createdAt: serverTimestamp()
  });
  console.log('🟢 Matriz creada:', matrizRef.id);

  // 4) CASO de ejemplo (subcolección: apps/{appId}/modulos/{moduloId}/matrices/{matrizId}/casos)
  const casoRef = await addDoc(collection(db, `apps/${appRef.id}/modulos/${moduloRef.id}/matrices/${matrizRef.id}/casos`), {
    NombreDelCaso: 'Validar transferencia SPEI exitosa',
    Descripcion: 'Caso positivo con monto válido y CLABE correcta.',
    Precondiciones: 'Usuario con sesión iniciada, CLABE destino válida.',
    Pasos: '1) Ingresar CLABE\n2) Ingresar monto\n3) Confirmar\n4) Verificar éxito',
    TipoDePrueba: 'Funcional',
    Criterio: true,
    ResultadoEsperado: 'Estado “Exitosa” y folio generado.',
    Tipo: 'Positivo',
    Estado: 'Positivo', // Pendiente | Positivo | Fallo | Bloqueado
    FechaEjecucion: serverTimestamp(),
    Comentarios: 'Se ejecutó con datos reales en QA.',
    EvidenciaNombre: 'spei_ok.png',
    EvidenciaUrl: 'https://example.com/spei_ok.png',
    Tester: 'daniel@finsus.mx',
    ReferenciaHU: 'HU-123',
    Fecha: serverTimestamp(),
    createdAt: serverTimestamp()
  });
  console.log('📄 Caso creado:', casoRef.id);

  // 5) BUG de ejemplo (subcolección: apps/{appId}/modulos/{moduloId}/matrices/{matrizId}/casos/{casoId}/bugs)
  const bugRef = await addDoc(collection(db,
    `apps/${appRef.id}/modulos/${moduloRef.id}/matrices/${matrizRef.id}/casos/${casoRef.id}/bugs`
  ), {
    nombre: 'Error en flujo de registro',
    descripcion: 'La app se cierra al registrar usuario nuevo',
    estado: 'Abierto', // Abierto | Corregido | Validado
    fechaReporte: serverTimestamp(),
    fechaCorreccion: null,
    tester: 'UID_TESTER_DEMO',
    desarrollador: 'UID_DEV_DEMO',
    evidenciaUrl: '',
    comentariosTester: 'Pendiente de revisión por dev',
    createdAt: serverTimestamp()
  });
  console.log('🐞 Bug creado:', bugRef.id);

  console.log('✅ Estructura creada correctamente con TODOS los campos solicitados.');
}

crearEstructuraSegunEsquema();
