import { auth, db } from './firebase-config.js';
import {
    doc,
    getDoc,
    updateDoc
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import {
    onAuthStateChanged,
    updateEmail,
    updatePassword
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';

// Campos
const formPerfil = document.getElementById('formPerfil');
const formPassword = document.getElementById('formPassword');
const nombreInput = document.getElementById('nombrePerfil');
const rolInput = document.getElementById('rolPerfil');
const correoInput = document.getElementById('correoPerfil');
const telefonoInput = document.getElementById('telefonoPerfil');

// --- Cargar datos del usuario ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        Swal.fire({
            icon: 'warning',
            title: 'Sesión expirada',
            text: 'Por favor inicia sesión nuevamente.',
            confirmButtonColor: '#23223F'
        }).then(() => window.location.href = 'index.html');
        return;
    }

    try {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const data = snap.data();
            nombreInput.value = data.name || '';
            rolInput.value = data.role || '';
            correoInput.value = user.email || '';
            telefonoInput.value = data.phone || '';
        }
    } catch (error) {
        console.error('Error cargando perfil:', error);
        Swal.fire('Error', 'No se pudo cargar tu información.', 'error');
    }
});

// --- Guardar datos de perfil (correo y teléfono) ---
formPerfil.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const nuevoCorreo = correoInput.value.trim();
    const nuevoTelefono = telefonoInput.value.trim();

    try {
        // 🔹 Actualizar email en Auth (solo si cambió)
        if (nuevoCorreo !== user.email) {
            await updateEmail(user, nuevoCorreo);
        }

        // 🔹 Actualizar datos en Firestore
        const ref = doc(db, 'users', user.uid);
        await updateDoc(ref, {
            email: nuevoCorreo,
            phone: nuevoTelefono
        });

        Swal.fire('Actualizado', 'Tu perfil se actualizó correctamente.', 'success');
    } catch (error) {
        console.error('Error al actualizar perfil:', error);
        Swal.fire('Error', 'No se pudo actualizar tu perfil.', 'error');
    }
});

// --- Cambiar contraseña ---
formPassword.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const nueva = document.getElementById('nuevaPassword').value.trim();
    const confirmar = document.getElementById('confirmarPassword').value.trim();

    if (nueva !== confirmar) {
        Swal.fire('Error', 'Las contraseñas no coinciden.', 'error');
        return;
    }

    try {
        await updatePassword(user, nueva);
        formPassword.reset();
        Swal.fire('Listo', 'Tu contraseña se actualizó correctamente.', 'success');
    } catch (error) {
        console.error('Error al cambiar contraseña:', error);
        Swal.fire('Error', 'No se pudo actualizar la contraseña.', 'error');
    }
});

