
// /js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js';


// TODO: Reemplaza con tu configuración real de Firebase
  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyA39kqrptGvhdJjH5wpPd7OIsL47yMaOWY",
    authDomain: "testingqa-67518.firebaseapp.com",
    projectId: "testingqa-67518",
    storageBucket: "testingqa-67518.firebasestorage.app",
    messagingSenderId: "93162740351",
    appId: "1:93162740351:web:6828e110dedb00e6ba7d4a"
  };

// Inicializa la app primero
const app = initializeApp(firebaseConfig);


export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
