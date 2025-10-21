import { db, auth } from './firebase-config.js';
import {
    addDoc, collection, serverTimestamp, getDocs, query, where, doc, getDoc, deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';

// ============================================================
// 🧩 VARIABLES GLOBALES
// ============================================================
let testerEmail = null;
const tableBody = document.querySelector('#matricesTable tbody');
const form = document.getElementById('matrixForm');
const testerField = document.getElementById('tester');
const modalElement = document.getElementById('newMatrixModal');
const modal = modalElement ? new bootstrap.Modal(modalElement) : null;

// ============================================================
// 🔐 DETECTAR USUARIO Y CARGAR MATRICES
// ============================================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        testerEmail = user.email;
        if (testerField) testerField.value = user.email;
        loadMatrices(user.email);
    } else {
        Swal.fire({
            icon: 'warning',
            title: 'Sesión no iniciada',
            text: 'Por favor inicia sesión para ver tus matrices.',
            confirmButtonColor: '#23223F'
        });
    }
});

// ============================================================
// 📋 CARGAR MATRICES
// ============================================================
async function loadMatrices(email) {
    try {
        tableBody.innerHTML = `
      <tr><td colspan="4" class="text-center text-muted">
        <div class="spinner-border text-dark"></div>
        <span class="ms-2">Cargando matrices...</span>
      </td></tr>`;

        const q = query(collection(db, 'matrices'), where('tester', '==', email));
        const snapshot = await getDocs(q);

        tableBody.innerHTML = '';

        if (snapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No hay matrices registradas</td></tr>`;
            return;
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td>${data.nombre}</td>
        <td>${data.descripcion}</td>
        <td>${data.tester}</td>
        <td class="text-nowrap">
          <button class="btn btn-sm btn-outline-primary me-2"
            onclick="viewCases('${docSnap.id}', '${data.nombre}')">📋 Ver casos</button>
          <button class="btn btn-sm btn-outline-success me-2"
            onclick="exportMatrixToExcel('${docSnap.id}', '${data.nombre}')">📤 Exportar</button>
          <button class="btn btn-sm btn-outline-danger"
            onclick="deleteMatrix('${docSnap.id}')">🗑️</button>
        </td>`;
            tableBody.appendChild(tr);
        });
    } catch (error) {
        console.error('🔥 Error al cargar matrices:', error);
        Swal.fire('Error', 'No se pudieron cargar las matrices', 'error');
    }
}

// ============================================================
// ➕ REGISTRAR MATRIZ
// ============================================================
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const data = {
            interfaz: form.interfaz.value.trim(),
            modulo: form.modulo.value.trim(),
            submodulo: form.submodulo.value.trim(),
            nombre: form.nombre.value.trim(),
            descripcion: form.descripcion.value.trim(),
            tester: testerField.value,
            createdAt: serverTimestamp()
        };

        await addDoc(collection(db, 'matrices'), data);
        Swal.fire({
            icon: 'success',
            title: '✅ Matriz registrada',
            text: 'Se ha guardado correctamente.',
            confirmButtonColor: '#23223F'
        });

        form.reset();
        testerField.value = auth.currentUser?.email || '';
        modal.hide();
        loadMatrices(testerField.value);
    } catch (error) {
        Swal.fire('Error', error.message, 'error');
    }
});


// ============================================================
// 🗑️ ELIMINAR MATRIZ
// ============================================================
window.deleteMatrix = async (id) => {
    const confirm = await Swal.fire({
        icon: 'warning',
        title: '¿Eliminar matriz?',
        text: 'Esto eliminará la matriz, pero no los casos asociados.',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, eliminar'
    });

    if (!confirm.isConfirmed) return;

    await deleteDoc(doc(db, 'matrices', id));
    loadMatrices(testerField.value);
};

// ============================================================
// 📁 VER CASOS DE UNA MATRIZ
// ============================================================
window.viewCases = (matrixId, matrixName) => {
    window.location.href = `casos.html?id=${matrixId}&nombre=${encodeURIComponent(matrixName)}`;
};

// ============================================================
// 📤 EXPORTAR MATRIZ A EXCEL CON RESUMEN QA
// ============================================================
async function exportMatrixToExcel(matrixId, matrixName) {
    try {
        const q = query(collection(db, 'casos'), where('matrixId', '==', matrixId));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            Swal.fire({
                icon: 'info',
                title: 'Sin casos',
                text: 'No hay casos registrados en esta matriz para exportar.',
                confirmButtonColor: '#23223F'
            });
            return;
        }

        // 🧩 Construir los datos
        const data = [];
        let stats = { total: 0, Pendiente: 0, Positivo: 0, Fallo: 0, Bloqueado: 0, NA: 0 };

        snapshot.forEach(docSnap => {
            const d = docSnap.data();
            const estatus = d.estatus || 'Pendiente';
            stats.total++;
            if (stats[estatus] !== undefined) stats[estatus]++;

            data.push({
                "Interfaz": d.interfaz || '',
                "Módulo": d.modulo || '',
                "Submódulo": d.submodulo || '',
                "Nombre del Caso": d.nombreCaso || '',
                "Descripción": d.descripcion || '',
                "Precondiciones / Datos de entrada": d.precondiciones || '',
                "Pasos": d.pasos || '',
                "Resultado Esperado": d.resultadoEsperado || '',
                "Tipo": d.tipo || '',
                "Estatus": d.estatus || '',
                "Tester": d.tester || '',
                "Comentarios": d.comentarios || '',
                "Referencia HU": d.referenciaHU || '',
                "Fecha de creación": d.createdAt?.toDate ? d.createdAt.toDate().toLocaleString() : ''
            });
        });

        // ============================================================
        // 🧾 HOJA 1: Casos de Prueba
        // ============================================================
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Casos de Prueba");
        ws['!cols'] = Object.keys(data[0]).map(() => ({ wch: 25 }));

        const headerStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "23223F" } },
            alignment: { horizontal: "center", vertical: "center" }
        };

        const header = Object.keys(data[0]);
        header.forEach((key, i) => {
            const cellAddr = XLSX.utils.encode_cell({ r: 0, c: i });
            if (ws[cellAddr]) ws[cellAddr].s = headerStyle;
        });

        const iconByStatus = {
            "Pendiente": "🕓 Pendiente",
            "Positivo": "✅ Positivo",
            "Fallo": "❌ Fallo",
            "Bloqueado": "🚫 Bloqueado",
            "N/A": "⚪ N/A"
        };
        data.forEach((d, i) => {
            const row = i + 2;
            const cell = ws[`J${row}`];
            if (cell && iconByStatus[d["Estatus"]]) cell.v = iconByStatus[d["Estatus"]];
        });

        // ============================================================
        // 📊 HOJA 2: Resumen QA
        // ============================================================
        const total = stats.total || 1;
        const resumen = [
            ["📋 Resumen de matriz:", matrixName],
            ["Fecha de generación:", new Date().toLocaleString()],
            [],
            ["Estatus", "Cantidad", "Porcentaje"],
            ["✅ Positivos", stats.Positivo, `${((stats.Positivo / total) * 100).toFixed(1)}%`],
            ["❌ Fallos", stats.Fallo, `${((stats.Fallo / total) * 100).toFixed(1)}%`],
            ["🚫 Bloqueados", stats.Bloqueado, `${((stats.Bloqueado / total) * 100).toFixed(1)}%`],
            ["🕓 Pendientes", stats.Pendiente, `${((stats.Pendiente / total) * 100).toFixed(1)}%`],
            ["⚪ N/A", stats.NA, `${((stats.NA / total) * 100).toFixed(1)}%`],
            [],
            ["Total de casos", stats.total, "100%"]
        ];

        const wsResumen = XLSX.utils.aoa_to_sheet(resumen);
        wsResumen['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen QA");

        // ============================================================
        // 💾 Exportar archivo
        // ============================================================
        const filename = `Matriz_${matrixName.replace(/\s+/g, '_')}.xlsx`;
        XLSX.writeFile(wb, filename);

        Swal.fire({
            icon: 'success',
            title: '📦 Archivo generado',
            text: `El archivo ${filename} se descargó correctamente.`,
            confirmButtonColor: '#23223F'
        });

    } catch (error) {
        console.error('🔥 Error exportando matriz:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al exportar',
            text: error.message,
            confirmButtonColor: '#d33'
        });
    }
}

// 👇 Exponer función global
window.exportMatrixToExcel = exportMatrixToExcel;
