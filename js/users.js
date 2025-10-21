import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

window.currentUser = null; // variable global disponible en toda la app

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
            const data = snap.data();

            window.currentUser = {
                uid: user.uid,
                email: user.email,
                name: data.name || user.email,
                role: data.role || 'Tester',
                status: data.status || 'Activo'
            };

            // Mostrar datos en el header
            const userName = document.getElementById('userName');
            const userRole = document.getElementById('userRole');

            if (userName) userName.textContent = window.currentUser.name;
            if (userRole) userRole.textContent = window.currentUser.role;

            aplicarRestriccionesPorRol(window.currentUser.role);
        }
    } else {
        window.currentUser = null;
    }
});

/**
 * 🔒 Aplica restricciones dinámicas según el rol
 */
function aplicarRestriccionesPorRol(role) {
    const linkUsuarios = document.getElementById('linkUsuarios');
    const linkMatrices = document.querySelector('a[href="matrices.html"]');
    const linkCasos = document.querySelector('a[href="casos.html"]');
    const linkBugs = document.querySelector('a[href="bugs.html"]');
    const linkDashboard = document.querySelector('a[href="dashboard.html"]');
    const linkBugsDashboard = document.querySelector('a[href="bugs-dashboard.html"]');

    switch (role) {
        case 'Administrador':
            // acceso total
            break;

        case 'Supervisor':
            if (linkUsuarios) linkUsuarios.style.display = 'block';
            break;

        case 'Tester':
            if (linkUsuarios) linkUsuarios.style.display = 'none';
            break;

        case 'Desarrollador':
            // solo acceso a dashboard de bugs
            if (linkDashboard) linkDashboard.style.display = 'none';
            if (linkMatrices) linkMatrices.style.display = 'none';
            if (linkCasos) linkCasos.style.display = 'none';
            if (linkUsuarios) linkUsuarios.style.display = 'none';
            if (linkBugs) linkBugs.style.display = 'none';
            if (linkBugsDashboard) linkBugsDashboard.style.display = 'block';
            break;
    }
}
