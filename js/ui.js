// /js/ui.js
import { auth, db } from './firebase-config.js';
import { logout } from './auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import { doc, getDoc, onSnapshot, collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

export async function loadNavbar() {
  try {
    const container = document.createElement('div');
    const response = await fetch('./components/navbar.html');
    if (!response.ok) throw new Error(`Error al cargar navbar.html: ${response.status}`);

    container.innerHTML = await response.text();
    document.body.prepend(container);
    window.logout = logout;

    // ---------- Estilos exclusivos ----------
    if (!document.getElementById('sidebar-style')) {
      const style = document.createElement('style');
      style.id = 'sidebar-style';
      style.textContent = `
        body { background-color: #f8f9fa; overflow-x: hidden; }

        #appSidebar {
          position: fixed;
          top: 0; left: 0;
          height: 100vh;
          width: 230px;
          background-color: #23223F;
          color: white;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: width 0.3s ease;
          z-index: 1040;
          overflow-y: auto;
        }

        #appSidebar a {
          color: white;
          text-decoration: none;
          padding: 12px 20px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 15px;
          transition: background 0.3s, padding-left 0.3s;
        }

        #appSidebar a:hover, #appSidebar a.active {
          background-color: #179DE9;
          padding-left: 25px;
        }

        #appSidebar.collapsed {
          width: 70px;
        }

        #appSidebar.collapsed a span {
          display: none;
        }

        #appSidebar.collapsed h5 {
          display: none;
        }

        #appHeader {
          background-color: white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
          padding: 10px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: fixed;
          top: 0; left: 230px; right: 0;
          height: 65px;
          z-index: 1030;
          transition: left 0.3s ease;
        }

        #appHeader.collapsed {
          left: 70px;
        }

        .main-content {
          margin-left: 230px;
          padding: 20px;
          padding-top: 90px;
          transition: margin-left 0.3s ease;
        }

        .main-content.collapsed {
          margin-left: 70px;
        }
      `;
      document.head.appendChild(style);
    }

    // ---------- Inicialización ----------
    const sidebar = document.getElementById('appSidebar');
    const header = document.getElementById('appHeader');
    const main = document.querySelector('.main-content');
    const toggleBtn = document.querySelector('.toggle-btn');

    // Barra colapsada por defecto
    sidebar.classList.add('collapsed');
    header.classList.add('collapsed');
    if (main) main.classList.add('collapsed');

    // Botón expandir/colapsar
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      header.classList.toggle('collapsed');
      if (main) main.classList.toggle('collapsed');
    });

    // Marcar link activo
    const path = window.location.pathname.split('/').pop();
    const activeLink = sidebar.querySelector(`a[href="${path}"]`);
    if (activeLink) activeLink.classList.add('active');

    // Control por rol
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          const role = data.role;
          document.getElementById('userName').textContent = data.name || user.email;
          document.getElementById('userRole').textContent = role;

          // Ocultar por rol
          const ocultar = (id) => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
          };

          if (!['Administrador', 'Supervisor'].includes(role)) {
            ocultar('linkApps');
            ocultar('linkUsuarios');
          }
        }
      }
    });
  } catch (error) {
    console.error('❌ Error al cargar la barra de navegación:', error);
  }
}

// ---------- Contador de tareas ----------
// 🔹 Contador de tareas pendientes y en progreso
// 🔹 Contador en tiempo real de tareas Pendientes / En progreso
export function actualizarContadorTareas() {
  onAuthStateChanged(auth, (user) => {
    const badge = document.getElementById('taskCountBadge');
    if (!user || !badge) return;

    try {
      const tareasRef = collection(db, `users/${user.uid}/tareas`);
      const q = query(tareasRef, where('estado', 'in', ['Pendiente', 'En progreso']));

      // 🟢 Escucha en tiempo real
      onSnapshot(q, (snapshot) => {
        const count = snapshot.size;

        if (count > 0) {
          badge.textContent = count;
          badge.style.display = 'inline';
        } else {
          badge.style.display = 'none';
        }
      });
    } catch (error) {
      console.error('❌ Error al escuchar tareas:', error);
    }
  });
}


if (document.readyState !== 'loading') actualizarContadorTareas();
else document.addEventListener('DOMContentLoaded', actualizarContadorTareas);
