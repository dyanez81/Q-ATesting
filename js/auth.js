// /js/auth.js
import { auth, db } from './firebase-config.js';
import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

// Detectar página
const path = window.location.pathname;
const isLogin = path.endsWith('/index.html') || path === '/' || path.endsWith('\\index.html');
const isUsuarios = path.endsWith('/usuarios.html') || path.endsWith('usuarios.html');

// --- LOGIN ---
if (isLogin) {
    const form = document.getElementById('loginForm');
    const pendingMessage = document.getElementById('pendingMessage');

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();
        if (pendingMessage) pendingMessage.style.display = 'none';

        try {
            const cred = await signInWithEmailAndPassword(auth, email, password);
            const user = cred.user;
            const ref = doc(db, 'users', user.uid);
            const snap = await getDoc(ref);

            if (!snap.exists()) {
                await Swal.fire({
                    icon: 'warning',
                    title: 'Cuenta no registrada',
                    text: 'No se encontró tu perfil en la base de datos. Regístrate primero.',
                    confirmButtonColor: '#1a73e8'
                });
                await signOut(auth);
                window.location.href = './register.html';
                return;
            }

            const data = snap.data();
            if (data.status !== 'Activo') {
                if (pendingMessage) pendingMessage.style.display = 'block';
                await Swal.fire({
                    icon: 'info',
                    title: 'Cuenta pendiente',
                    text: 'Un administrador debe aprobar tu cuenta.',
                    confirmButtonColor: '#23223F'
                });
                await signOut(auth);
                return;
            }

            // Guardar info global
            window.currentUser = {
                uid: user.uid,
                email: user.email,
                name: data.name || user.email,
                role: data.role || 'Tester',
                status: data.status || 'Activo'
            };

            await Swal.fire({
                icon: 'success',
                title: `¡Bienvenido, ${window.currentUser.name}!`,
                timer: 1500,
                showConfirmButton: false
            });

            // Redirigir al dashboard general
            window.location.href = './dashboard.html';
        } catch (err) {
            let msg = 'Error de inicio de sesión.';
            if (err.code === 'auth/user-not-found') msg = 'Usuario no encontrado. Regístrate primero.';
            if (err.code === 'auth/wrong-password') msg = 'Contraseña incorrecta.';
            await Swal.fire({ icon: 'error', title: 'Inicio de sesión fallido', text: msg });
        }
    });
}

// --- CONTROL GLOBAL DE SESIÓN Y ROLES ---
onAuthStateChanged(auth, async (user) => {
    if (!user && !isLogin) {
        window.location.href = './index.html';
        return;
    }

    if (user) {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
            await signOut(auth);
            window.location.href = './index.html';
            return;
        }

        const data = snap.data();
        const role = data.role || 'Tester';
        const status = data.status || 'Pendiente';

        window.currentUser = {
            uid: user.uid,
            email: user.email,
            name: data.name || user.email,
            role,
            status
        };

        // Bloquear usuarios inactivos
        if (status !== 'Activo' && !isLogin) {
            await Swal.fire({
                icon: 'info',
                title: 'Cuenta inactiva',
                text: 'Tu cuenta no está activa. Contacta al administrador.',
                confirmButtonColor: '#1a73e8'
            });
            await signOut(auth);
            window.location.href = './index.html';
            return;
        }

      // Si no es admin/supervisor → bloquear acceso a usuarios.html
        if (isUsuarios && !['Administrador', 'Supervisor'].includes(role)) {
            await Swal.fire({
                icon: 'error',
                title: 'Acceso restringido',
                text: 'Solo administradores o supervisores pueden acceder aquí.',
                confirmButtonColor: '#d33'
            });
            window.location.href = './dashboard.html';
        } 
    }
});

// --- LOGOUT ---
export async function logout() {
    const confirmLogout = await Swal.fire({
        icon: 'question',
        title: '¿Cerrar sesión?',
        showCancelButton: true,
        confirmButtonColor: '#1a73e8',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, salir'
    });

    if (!confirmLogout.isConfirmed) return;

    await signOut(auth);
    window.location.href = './index.html';
}
