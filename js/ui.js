// /js/ui.js
import { auth, db } from './firebase-config.js';
import { logout } from './auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

export async function loadNavbar() {
  try {
    const container = document.createElement('div');
    const response = await fetch('./components/navbar.html');
    if (!response.ok) throw new Error(`Error al cargar navbar.html: ${response.status}`);

    const html = await response.text();
    container.innerHTML = html;

    // 🔹 Insertar al inicio del <body>
    document.body.prepend(container);

    // 🔹 Asegurar función logout disponible globalmente
    window.logout = logout;

    // 🔹 Importar dinámicamente Dropdown o usar fallback si bootstrap.bundle ya está cargado
    try {
      const { Dropdown } = await import('https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.esm.min.js');
      document.querySelectorAll('[data-bs-toggle="dropdown"]').forEach(el => new Dropdown(el));
    } catch {
      // Fallback: si el bundle ya está en la página
      if (window.bootstrap?.Dropdown) {
        document.querySelectorAll('[data-bs-toggle="dropdown"]').forEach(el => new window.bootstrap.Dropdown(el));
      }
    }

    // 🔹 Agregar estilos globales (solo si no existen)
    if (!document.getElementById('global-navbar-style')) {
      const style = document.createElement('style');
      style.id = 'global-navbar-style';
      style.textContent = `
        body {
          background-color: #f8f9fa;
          overflow-x: hidden;
        }
        .sidebar {
          position: fixed;
          top: 0;
          left: 0;
          height: 100%;
          width: 230px;
          background-color: #23223F;
          color: white;
          padding-top: 20px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: width 0.3s ease;
          z-index: 1040;
        }
        .sidebar a {
          color: white;
          text-decoration: none;
          padding: 12px 20px;
          display: block;
          font-size: 15px;
          transition: background 0.3s, padding-left 0.3s;
        }
        .sidebar a:hover, .sidebar a.active {
          background-color: #179DE9;
          padding-left: 25px;
        }
        .sidebar.collapsed { width: 70px; }
        .sidebar.collapsed a span,
        .sidebar.collapsed h5,
        .sidebar.collapsed .btn span {
          display: none;
        }
        .header {
          background-color: white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
          padding: 10px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: fixed;
          top: 0;
          left: 230px;
          right: 0;
          height: 65px;
          z-index: 1030;
          transition: left 0.3s ease;
        }
        .header.collapsed { left: 70px; }
        .main-content {
          margin-left: 230px;
          padding: 20px;
          padding-top: 90px; /* 🔧 deja espacio para el header fijo */
          transition: margin-left 0.3s ease;
        }
        .main-content.collapsed { margin-left: 70px; }
        .dropdown-menu { z-index: 1080; }
      `;
      document.head.appendChild(style);
      
    }

    // 🔹 Marcar el link activo
    const path = window.location.pathname.split('/').pop();
    const activeLink = container.querySelector(`a[href="${path}"]`);
    if (activeLink) activeLink.classList.add('active');

    // 🔹 Control colapsable de sidebar
    const toggleBtn = container.querySelector('.toggle-btn');
    const sidebar = container.querySelector('.sidebar');
    const header = container.querySelector('.header');
    const main = document.querySelector('.main-content');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        header?.classList.toggle('collapsed');
        main?.classList.toggle('collapsed');
      });
    }

    // 🔹 Controlar visibilidad por rol y mostrar datos del usuario
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          const role = data.role;
          document.getElementById('userName').textContent = data.name || user.email;
          document.getElementById('userRole').textContent = role;

          const linkApps = document.getElementById('linkApps');
          const linkUsuarios = document.getElementById('linkUsuarios');

          // 🔸 Solo Admin y Supervisor pueden ver Apps y Usuarios
          if (!['Administrador', 'Supervisor'].includes(role)) {
            if (linkApps) linkApps.style.display = 'none';
            if (linkUsuarios) linkUsuarios.style.display = 'none';
          }
        }
      }
    });
  } catch (error) {
    console.error('❌ Error al cargar la barra de navegación:', error);
  }

}
export async function actualizarContadorTareas() {
  onAuthStateChanged(auth, async (user) => {
    const badge = document.getElementById('taskCountBadge');
    if (!user || !badge) return;

    try {
      const tareasRef = collection(db, `users/${user.uid}/tareas`);
      const q = query(tareasRef, where('estado', '==', 'Pendiente'));
      const snapshot = await getDocs(q);

      if (snapshot.size > 0) {
        badge.textContent = snapshot.size;
        badge.style.display = 'inline';
      } else {
        badge.style.display = 'none';
      }
    } catch (error) {
      console.error('Error al obtener tareas:', error);
    }
  });
}

// Llama la función automáticamente si ya se cargó el navbar
if (document.readyState !== 'loading') {
  actualizarContadorTareas();
} else {
  document.addEventListener('DOMContentLoaded', actualizarContadorTareas);
}


