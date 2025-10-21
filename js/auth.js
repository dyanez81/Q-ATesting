// /js/auth.js
import { auth, db } from './firebase-config.js';
import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import {
    doc, getDoc
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

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
                    text: 'No tienes una cuenta registrada en el sistema. Por favor, regístrate primero.',
                    confirmButtonColor: '#1a73e8',
                    confirmButtonText: 'Ir al registro'
                });
                await signOut(auth);
                window.location.href = './register.html';
                return;
            }

            const data = snap.data();

            if (data.status !== 'Activo') {
                if (pendingMessage) pendingMessage.style.display = 'block';
                await Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'info',
                    title: 'Cuenta pendiente',
                    text: 'Un administrador debe aprobar tu cuenta.',
                    showConfirmButton: false,
                    timer: 3000
                });
                await signOut(auth);
                return;
            }

            // ✅ Usuario válido y activo
            await Swal.fire({
                icon: 'success',
                title: 'Bienvenido',
                text: `¡Hola ${data.name || 'usuario'}!`,
                timer: 1500,
                showConfirmButton: false
            });

            // Redirigir a dashboard general
            window.location.href = './dashboard.html';
        } catch (err) {
            if (err.code === 'auth/user-not-found') {
                await Swal.fire({
                    icon: 'warning',
                    title: 'Usuario no encontrado',
                    text: 'No se encontró una cuenta con este correo. Regístrate primero.',
                    confirmButtonColor: '#1a73e8',
                    confirmButtonText: 'Ir al registro'
                });
                window.location.href = './register.html';
            } else if (err.code === 'auth/wrong-password') {
                await Swal.fire({
                    icon: 'error',
                    title: 'Contraseña incorrecta',
                    text: 'Verifica tus credenciales e intenta nuevamente.',
                    confirmButtonColor: '#d33'
                });
            } else {
                await Swal.fire({
                    icon: 'error',
                    title: 'Error de inicio de sesión',
                    text: err.message,
                    confirmButtonColor: '#d33'
                });
            }
        }
    });
}

// --- CONTROL DE ROLES Y ACCESO ---
onAuthStateChanged(auth, async (user) => {
    if (!user && !isLogin) {
        window.location.href = './index.html';
        return;
    }

    if (user) {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);

        let role = 'Tester';
        let status = 'Pendiente';

        if (snap.exists()) {
            const data = snap.data();
            role = data.role || 'Tester';
            status = data.status || 'Pendiente';
        }

        // Bloquear acceso a no activos
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

        // 🔹 Mostrar u ocultar menú Usuarios
        const usersLink = document.querySelector('a[href$="usuarios.html"]');
        if (usersLink) usersLink.style.display = role === 'Administrador' ? 'block' : 'none';

        // 🔹 Si no es admin y trata de entrar a usuarios.html → redirigir
        if (isUsuarios && role !== 'Administrador') {
            await Swal.fire({
                icon: 'error',
                title: 'Acceso restringido',
                text: 'Solo los administradores pueden acceder a esta sección.',
                confirmButtonColor: '#d33'
            });
            window.location.href = './dashboard.html';
            return;
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
        confirmButtonText: 'Sí, salir',
        cancelButtonText: 'Cancelar'
    });

    if (!confirmLogout.isConfirmed) return;

    try {
        await signOut(auth);
        window.location.href = './index.html';
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        await Swal.fire({
            icon: 'error',
            title: 'Error al cerrar sesión',
            text: error.message
        });
    }
}
