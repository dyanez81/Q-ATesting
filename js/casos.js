import { db, auth } from './firebase-config.js';
import {
    addDoc, getDoc, updateDoc, deleteDoc, doc, collection,
    getDocs, query, where, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import {
    getStorage,
    ref,
    uploadBytes
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js';

const storage = getStorage();

document.addEventListener('DOMContentLoaded', () => {

    // ================================
    // 🔹 VARIABLES Y ELEMENTOS
    // ================================
    const urlParams = new URLSearchParams(window.location.search);
    const matrixId = urlParams.get('id');
    const matrixName = decodeURIComponent(urlParams.get('nombre') || '');
    const titleEl = document.getElementById('matrixName');
    const matrixInput = document.getElementById('matrixId');
    const form = document.getElementById('caseForm');
    const modalElement = document.getElementById('newCaseModal');
    const modal = modalElement ? new bootstrap.Modal(modalElement) : null;
    const tableBody = document.querySelector('#casesTable tbody');
    const testerField = document.getElementById('tester');

    let editingId = null;
    let currentUser = null;

    if (titleEl) titleEl.textContent = `📘 Casos pertenecientes a la matriz: ${matrixName}`;
    if (matrixInput) matrixInput.value = matrixId;

    // ============================================================
    // 🔹 DETECTAR USUARIO Y CARGAR CASOS
    // ============================================================
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            if (testerField) testerField.value = user.email;
            loadCases(matrixId);
        } else {
            Swal.fire({
                icon: 'warning',
                title: 'Sesión no iniciada',
                text: 'Debes iniciar sesión para ver los casos.',
                confirmButtonColor: '#23223F'
            });
        }
    });

    // ============================================================
    // 🔹 CARGAR CASOS CON ICONOS SEGÚN ESTATUS
    // ============================================================
    async function loadCases(matrixId) {
        try {
            tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted">
          <div class="spinner-border text-dark" role="status"></div>
          <span class="ms-2">Cargando casos...</span>
        </td>
      </tr>`;

            const q = query(collection(db, 'casos'), where('matrixId', '==', matrixId));
            const snapshot = await getDocs(q);

            tableBody.innerHTML = '';

            if (snapshot.empty) {
                tableBody.innerHTML = `
        <tr><td colspan="6" class="text-center text-muted">No hay casos registrados</td></tr>`;
                return;
            }

            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const icon = getStatusIcon(data.estatus || 'Pendiente');
                const colorClass = getStatusColor(data.estatus || 'Pendiente');

                const tr = document.createElement('tr');
                tr.innerHTML = `
        <td>${data.nombreCaso}</td>
        <td>${data.tipo}</td>
        <td>
          <span class="badge bg-${colorClass} d-flex align-items-center justify-content-center gap-2">
            ${icon} ${data.estatus || 'Pendiente'}
          </span>
        </td>
        <td>${data.tester}</td>
        <td class="text-nowrap">
          <button class="btn btn-sm btn-outline-success me-2" onclick="openBugsModal('${docSnap.id}', '${data.nombreCaso}')">🐞</button>
          <button class="btn btn-sm btn-outline-primary me-2" onclick="editCase('${docSnap.id}')">✏️</button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteCase('${docSnap.id}')">🗑️</button>
        </td>`;
                tableBody.appendChild(tr);
            });

        } catch (error) {
            console.error('🔥 Error al cargar casos:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error al cargar casos',
                text: 'Hubo un problema al conectar con Firestore. Verifica tu conexión o permisos.',
                confirmButtonColor: '#d33'
            });
        }
    }

    // ============================================================
    // 🎨 ÍCONOS Y COLORES POR ESTATUS
    // ============================================================
    function getStatusIcon(status) {
        switch (status) {
            case 'Pendiente': return '🕓';
            case 'Positivo': return '✅';
            case 'Fallo': return '❌';
            case 'Bloqueado': return '🚫';
            case 'N/A': return '⚪';
            default: return '🔘';
        }
    }

    function getStatusColor(status) {
        switch (status) {
            case 'Pendiente': return 'secondary';
            case 'Positivo': return 'success';
            case 'Fallo': return 'danger';
            case 'Bloqueado': return 'warning text-dark';
            case 'N/A': return 'light text-dark';
            default: return 'info';
        }
    }

    // ============================================================
    // 🔹 CREAR / EDITAR CASO
    // ============================================================
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            try {
                if (!currentUser) throw new Error('Usuario no autenticado');

                const data = {
                    matrixId,
                    nombreCaso: form.nombreCaso.value.trim(),
                    descripcion: form.descripcion.value.trim(),
                    precondiciones: form.precondiciones.value.trim(),
                    pasos: form.pasos.value.trim(),
                    resultadoEsperado: form.resultadoEsperado.value.trim(),
                    tipo: form.tipo.value,
                    estatus: form.estatus.value,
                    tester: currentUser.email,
                    updatedAt: new Date()
                };

                if (editingId) {
                    const ref = doc(db, 'casos', editingId);
                    await updateDoc(ref, data);
                    Swal.fire('✅ Caso actualizado', 'Los cambios se guardaron correctamente.', 'success');
                    editingId = null;
                } else {
                    const matrizRef = doc(db, 'matrices', matrixId);
                    const matrizSnap = await getDoc(matrizRef);
                    if (matrizSnap.exists()) {
                        const matriz = matrizSnap.data();
                        data.interfaz = matriz.interfaz || '';
                        data.modulo = matriz.modulo || '';
                        data.submodulo = matriz.submodulo || '';
                    }

                    data.createdAt = serverTimestamp();
                    await addDoc(collection(db, 'casos'), data);
                    Swal.fire('✅ Caso registrado', 'El caso se agregó correctamente.', 'success');
                }

                form.reset();
                if (testerField) testerField.value = currentUser.email;
                if (modal) modal.hide();
                loadCases(matrixId);

            } catch (error) {
                console.error('🔥 Error:', error);
                Swal.fire('Error', error.message, 'error');
            }
        });
    }

    // ============================================================
    // 🔹 EDITAR CASO (FUNCIONAL)
    // ============================================================
    async function editCase(id) {
        try {
            const ref = doc(db, 'casos', id);
            const snap = await getDoc(ref);
            if (!snap.exists()) return Swal.fire('Error', 'Caso no encontrado', 'error');

            const data = snap.data();
            editingId = id;
            document.getElementById('caseLabel').textContent = '✏️ Editar caso de prueba';

            form.nombreCaso.value = data.nombreCaso || '';
            form.descripcion.value = data.descripcion || '';
            form.precondiciones.value = data.precondiciones || '';
            form.pasos.value = data.pasos || '';
            form.resultadoEsperado.value = data.resultadoEsperado || '';
            form.tipo.value = data.tipo || '';
            form.estatus.value = data.estatus || 'Pendiente';
            form.tester.value = data.tester || '';

            modal.show();
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudo cargar el caso.', 'error');
        }
    }
    window.editCase = editCase;

    // ============================================================
    // 🔹 ELIMINAR CASO (FUNCIONAL)
    // ============================================================
    async function deleteCase(id) {
        const confirm = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar caso?',
            text: 'Esta acción no se puede deshacer.',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (!confirm.isConfirmed) return;
        await deleteDoc(doc(db, 'casos', id));
        Swal.fire('🗑️ Eliminado', 'El caso fue eliminado.', 'success');
        loadCases(matrixId);
    }
    window.deleteCase = deleteCase;

    // ============================================================
    // 🐞 SEGUIMIENTO DE BUGS CON IMAGEN
    // ============================================================
    let currentCaseId = null;
    const bugsModalEl = document.getElementById('bugsModal');
    const bugsModal = bugsModalEl ? new bootstrap.Modal(bugsModalEl) : null;
    const bugCaseName = document.getElementById('bugCaseName');
    const bugsTableBody = document.querySelector('#bugsTable tbody');
    const bugForm = document.getElementById('bugForm');
    const bugReporter = document.getElementById('bugReportadoPor');

    if (bugReporter && currentUser) bugReporter.value = currentUser.email;

    async function openBugsModal(caseId, caseName) {
        currentCaseId = caseId;
        if (bugCaseName) bugCaseName.textContent = caseName;
        if (bugsModal) bugsModal.show();
        loadBugs(caseId);
    }
    window.openBugsModal = openBugsModal;

    async function loadBugs(caseId) {
        bugsTableBody.innerHTML = '';
        const q = query(collection(db, 'bugs'), where('caseId', '==', caseId));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            bugsTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Sin bugs reportados</td></tr>`;
            return;
        }

        snapshot.forEach(docSnap => {
            const bug = docSnap.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td>${bug.titulo}</td>
        <td>${bug.descripcion}</td>
        <td><span class="badge bg-${getBugStatusColor(bug.estatus)}">${bug.estatus}</span></td>
        <td>${bug.reportadoPor}</td>
        <td>${bug.asignadoA || '-'}</td>
        <td>${bug.imagenPath ? `<i class="bi bi-image text-primary" title="Tiene evidencia"></i>` : '-'}</td>
        <td><button class="btn btn-sm btn-outline-danger" onclick="deleteBug('${docSnap.id}')">🗑️</button></td>`;
            bugsTableBody.appendChild(tr);
        });
    }

    if (bugForm) {
        bugForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            try {
                if (!currentCaseId) throw new Error('No se ha seleccionado un caso.');
                if (!currentUser) throw new Error('Usuario no autenticado.');

                const file = document.getElementById('bugImage')?.files[0];
                let imagePath = null;

                if (file) {
                    const fileName = `${Date.now()}_${file.name}`;
                    const storageRef = ref(storage, `bugs/${fileName}`);
                    await uploadBytes(storageRef, file);
                    imagePath = storageRef.fullPath;
                }

                const bugData = {
                    caseId: currentCaseId,
                    titulo: bugForm.bugTitulo.value.trim(),
                    descripcion: bugForm.bugDescripcion.value.trim(),
                    estatus: bugForm.bugEstatus.value,
                    asignadoA: bugForm.bugAsignado.value.trim(),
                    reportadoPor: bugReporter.value,
                    creadoEn: serverTimestamp(),
                    imagenPath: imagePath
                };

                await addDoc(collection(db, 'bugs'), bugData);
                bugForm.reset();
                loadBugs(currentCaseId);
                Swal.fire('🐞 Bug registrado', 'Se ha guardado correctamente.', 'success');
            } catch (error) {
                console.error('🔥 Error al registrar bug:', error);
                Swal.fire('Error', error.message, 'error');
            }
        });
    }

    window.deleteBug = async (id) => {
        const confirm = await Swal.fire({
            icon: 'warning',
            title: '¿Eliminar bug?',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });
        if (!confirm.isConfirmed) return;
        await deleteDoc(doc(db, 'bugs', id));
        loadBugs(currentCaseId);
    };

    function getBugStatusColor(status) {
        switch (status) {
            case 'Abierto': return 'danger';
            case 'En progreso': return 'warning text-dark';
            case 'Resuelto': return 'success';
            case 'Rechazado': return 'secondary';
            default: return 'light text-dark';
        }
    }
});
