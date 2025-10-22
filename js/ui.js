// /js/ui.js
export async function loadNavbar() {
  try {
    const container = document.createElement('div');
    const response = await fetch('./components/navbar.html');
    if (!response.ok) throw new Error(`Error al cargar navbar.html: ${response.status}`);
    const html = await response.text();
    container.innerHTML = html;
    document.body.prepend(container);

    // --- Asegurar Bootstrap Icons (global) ---
    if (!document.getElementById('bootstrap-icons')) {
      const link = document.createElement('link');
      link.id = 'bootstrap-icons';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css';
      document.head.appendChild(link);
    }

    // --- Estilos globales (una sola vez) ---
    if (!document.getElementById('global-navbar-style')) {
      const style = document.createElement('style');
      style.id = 'global-navbar-style';
      style.textContent = `
        body {
          background-color: #f8f9fa;
          margin: 0;
          padding: 0;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        /* --- Sidebar --- */
        .sidebar {
          position: fixed;
          top: 0;
          left: 0;
          height: 100%;
          width: 230px;
          background-color: #23223F;
          color: white;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: width 0.3s ease, left 0.3s ease;
          z-index: 1000;
          overflow: hidden;
        }

        /* --- Título principal --- */
        .sidebar h5 {
          text-align: center;
          font-weight: bold;
          margin-bottom: 1rem;
          transition: opacity 0.3s ease;
        }

        /* --- Enlaces --- */
        .sidebar a {
          color: white;
          text-decoration: none;
          padding: 12px 20px;
          display: flex;
          align-items: center;
          font-size: 15px;
          transition: background 0.3s, padding-left 0.3s, opacity 0.3s;
          white-space: nowrap;
        }

        .sidebar a i {
          min-width: 24px;
          text-align: center;
          font-size: 18px;
        }

        .sidebar a span {
          margin-left: 10px;
          transition: opacity 0.3s ease;
        }

        .sidebar a:hover,
        .sidebar a.active {
          background-color: #179DE9;
        }

        /* --- Footer --- */
        .sidebar .p-3 {
          text-align: center;
          transition: all 0.3s ease;
        }

        .sidebar .logout-icon {
          display: none;
          font-size: 20px;
        }

        /* --- Estado colapsado --- */
        .sidebar.collapsed {
          width: 70px;
        }

        .sidebar.collapsed h5 {
          opacity: 0;
          pointer-events: none;
        }

        .sidebar.collapsed a span {
          opacity: 0;
          pointer-events: none;
        }

        .sidebar.collapsed .p-3 button span {
          display: none; /* oculta el texto del botón */
        }

        .sidebar.collapsed .p-3 .logout-icon {
          display: inline; /* muestra el ícono de logout */
        }

        .sidebar.collapsed .p-3 {
          padding: 0.5rem 0;
        }

        /* --- Header --- */
        .header {
          position: fixed;
          top: 0;
          left: 230px;
          right: 0;
          height: 70px;
          background-color: white;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
          padding: 10px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 999;
          transition: left 0.3s ease;
        }

        .header.collapsed {
          left: 70px;
        }

        /* --- Contenido principal --- */
        .main-content {
          margin-left: 230px;
          margin-top: 80px;
          padding: 20px;
          transition: margin-left 0.3s ease;
        }

        .main-content.collapsed {
          margin-left: 70px;
        }

        /* --- Botón hamburguesa --- */
        .hamburger-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #23223F;
          margin-right: 15px;
        }

        /* --- Responsive --- */
        @media (max-width: 992px) {
          .sidebar {
            left: -230px;
          }
          .sidebar.active {
            left: 0;
          }
          .header {
            left: 0;
          }
          .main-content {
            margin-left: 0;
          }
        }
      `;


      document.head.appendChild(style);
    }

    // --- Referencias ---
    const sidebar = container.querySelector('.sidebar');
    const header = container.querySelector('.header');
    const main = document.querySelector('.main-content');

    // --- Agregar botón hamburguesa si no existe ---
    if (header && !header.querySelector('.hamburger-btn')) {
      const btn = document.createElement('button');
      btn.classList.add('hamburger-btn');
      btn.innerHTML = '<i class="bi bi-list"></i>';
      header.querySelector('.brand')?.prepend(btn); // aparece junto al logo

      btn.addEventListener('click', () => toggleSidebar(sidebar, header, main));
    }

    // --- Aplicar estado previo del menú ---
    const estadoSidebar = localStorage.getItem('sidebarState') || 'expanded';
    if (estadoSidebar === 'collapsed') {
      sidebar?.classList.add('collapsed');
      header?.classList.add('collapsed');
      main?.classList.add('collapsed');
    }

    // --- Marcar el link activo ---
    const path = window.location.pathname.split('/').pop();
    const links = container.querySelectorAll('.sidebar a');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href && path === href) link.classList.add('active');
    });
    

  } catch (error) {
    console.error('❌ Error al cargar la barra de navegación:', error);
  }
}

/**
 * Alternar sidebar y guardar el estado en localStorage
 */
function toggleSidebar(sidebar, header, main) {
  if (window.innerWidth > 992) {
    // En escritorio: colapsa o expande
    const isCollapsed = sidebar.classList.toggle('collapsed');
    header?.classList.toggle('collapsed');
    main?.classList.toggle('collapsed');
    localStorage.setItem('sidebarState', isCollapsed ? 'collapsed' : 'expanded');
  } else {
    // En móvil: mostrar/ocultar sidebar completo
    sidebar.classList.toggle('active');
  }
}
