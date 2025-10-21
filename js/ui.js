// /js/ui.js
export async function loadNavbar() {
    try {
        const container = document.createElement('div');
        const response = await fetch('./components/navbar.html');
        const html = await response.text();
        container.innerHTML = html;

        // Insertar al principio del body
        document.body.prepend(container);

        // Aplicar estilo global si no existe
        const style = document.createElement('style');
        style.textContent = `
      body { background-color: #f8f9fa; }
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
      }
      .sidebar a {
        color: white;
        text-decoration: none;
        padding: 12px 20px;
        display: block;
        font-size: 15px;
        transition: background 0.3s;
      }
      .sidebar a:hover, .sidebar a.active {
        background-color: #179DE9;
      }
      .header {
        background-color: white;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
        padding: 10px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: sticky;
        top: 0;
        z-index: 10;
        margin-left: 230px;
      }
      .main-content {
        margin-left: 230px;
        padding: 20px;
      }
    `;
        document.head.appendChild(style);

        // Marcar link activo
        const path = window.location.pathname.split('/').pop();
        const activeLink = container.querySelector(`a[href="${path}"]`);
        if (activeLink) activeLink.classList.add('active');
    } catch (error) {
        console.error('Error al cargar la barra de navegación:', error);
    }
}
