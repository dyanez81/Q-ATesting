import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

window.currentUser = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
            const data = snap.data();
            window.currentUser = {
                uid: user.uid,
                email: user.email,
                name: data.name || user.email,
                role: data.role || 'Tester',
                status: data.status || 'Activo'
            };

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

function aplicarRestriccionesPorRol(role) {
    const linkUsuarios = document.querySelector('a[href="usuarios.html"]');
    const linkDashboard = document.querySelector('a[href="dashboard.html"]');
    const linkBugsDashboard = document.querySelector('a[href="bugs-dashboard.html"]');

    // 🔹 Primero mostramos todo por defecto
    [linkUsuarios, linkDashboard, linkBugsDashboard].forEach(link => {
        if (link) link.style.display = 'block';
    });

    // 🔹 Luego aplicamos restricciones específicas
    switch (role) {
        case 'Administrador':
            // Acceso completo → no se oculta nada
            break;

        case 'Supervisor':
            // Supervisor no ve usuarios
            break;

        case 'Tester':
            // Tester tampoco ve usuarios
            if (linkUsuarios) linkUsuarios.style.display = 'none';
            break;

        case 'Desarrollador':
            // Desarrollador ve solo Bugs y Dashboard Bugs
            if (linkUsuarios) linkUsuarios.style.display = 'none';
            if (linkDashboard) linkDashboard.style.display = 'none';
            break;
    }
}
