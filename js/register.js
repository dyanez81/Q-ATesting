// /js/register.js
import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import {
  doc, setDoc
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

const form = document.getElementById('registerForm');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const lastname = document.getElementById('lastname').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const phone = document.getElementById('phone').value.trim();

  if (!/^\d{10}$/.test(phone)) {
    await Swal.fire({
      icon: 'warning',
      title: 'Teléfono inválido',
      text: 'Debes ingresar un número de 10 dígitos.',
      confirmButtonColor: '#23223F'
    });
    return;
  }

  try {
    // Crear usuario en Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await updateProfile(user, { displayName: `${name} ${lastname}` });

    // Guardar en Firestore
    await setDoc(doc(db, 'users', user.uid), {
      name,
      lastname,
      email,
      phone,
      role: 'Tester',
      status: 'Pendiente',
      createdAt: new Date()
    });

    await Swal.fire({
      icon: 'success',
      title: 'Registro exitoso 🎉',
      text: 'Tu cuenta ha sido creada. Un administrador deberá aprobar tu acceso antes de que puedas iniciar sesión.',
      confirmButtonColor: '#23223F'
    });

    await signOut(auth);
    window.location.href = 'index.html';

  } catch (error) {
    console.error(error);
    let msg = 'Ocurrió un error durante el registro.';
    if (error.code === 'auth/email-already-in-use') msg = 'El correo ya está registrado.';
    if (error.code === 'auth/weak-password') msg = 'La contraseña debe tener al menos 6 caracteres.';
    if (error.code === 'auth/invalid-email') msg = 'El correo ingresado no es válido.';

    await Swal.fire({
      icon: 'error',
      title: 'Error de registro',
      text: msg,
      confirmButtonColor: '#d33'
    });
  }
});
