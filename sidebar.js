/* ═══════════════════════════════════════════════════════════════════════
   SIDEBAR.JS - NAVEGACIÓN PRINCIPAL
   ═══════════════════════════════════════════════════════════════════════ */

// ELEMENTOS DEL DOM
const sidebar = document.querySelector(".sidebar");
const sidebarToggle = document.querySelector(".sidebar-toggle");
const sidebarOverlay = document.querySelector(".sidebar-overlay");
const menuBtn = document.getElementById("menuBtn");

// TOGGLE SIDEBAR
function toggleSidebar() {
  sidebar.classList.toggle("active");
  sidebarOverlay.classList.toggle("active");
  document.body.style.overflow = sidebar.classList.contains("active") ? "hidden" : "auto";
}

// CERRAR SIDEBAR
function closeSidebar() {
  sidebar.classList.remove("active");
  sidebarOverlay.classList.remove("active");
  document.body.style.overflow = "auto";
}

// EVENT LISTENERS
if (sidebarToggle) sidebarToggle.addEventListener("click", closeSidebar);
if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeSidebar);
if (menuBtn) menuBtn.addEventListener("click", toggleSidebar);

// Cerrar sidebar al hacer click en un link
document.querySelectorAll(".sidebar-link").forEach(link => {
  link.addEventListener("click", closeSidebar);
});

// Inicio en index.html: evitar recarga y mostrar categorías
document.querySelectorAll('.sidebar-link[href="index.html"]').forEach(link => {
  link.addEventListener("click", (e) => {
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    if (currentPage === "index.html") {
      e.preventDefault();
      if (typeof irInicioCategorias === "function") {
        irInicioCategorias();
        return;
      }
      if (typeof mostrarCategorias === "function") {
        mostrarCategorias();
      }
      if (typeof cargar === "function") {
        cargar();
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
});

// Cerrar sidebar con Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSidebar();
});

// ═══════════════════════════════════════════════════════════════════════
// FUNCIONES DE NAVEGACIÓN
// ═══════════════════════════════════════════════════════════════════════

function abrirAdmin(event) {
  event.preventDefault();
  // Verificar si ya está autenticado
  const adminToken = localStorage.getItem("adminToken");
  if (adminToken) {
    window.location.href = "admin.html";
  } else {
    window.location.href = "admin.html";
  }
}

// ═══════════════════════════════════════════════════════════════════════
// DETECCIÓN DE PÁGINA ACTIVA
// ═══════════════════════════════════════════════════════════════════════

window.addEventListener("load", () => {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  
  document.querySelectorAll(".sidebar-link").forEach(link => {
    link.classList.remove("active");
    const href = link.getAttribute("href");
    if (href === currentPage || (currentPage === "" && href === "index.html")) {
      link.classList.add("active");
    }
  });
});

// Marcar admin como activo si viene de admin.html
if (window.location.pathname.includes("admin.html")) {
  document.querySelectorAll(".sidebar-link").forEach(link => {
    link.classList.remove("active");
    if (link.getAttribute("href") === "admin.html") {
      link.classList.add("active");
    }
  });
}
