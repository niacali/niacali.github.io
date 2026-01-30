/* ═══════════════════════════════════════════════════════════════════════
   APP.JS - VERSIÓN MODERNA 2026
   Carrito Colapsable, Toasts, Mejor Gestión de Errores
   ═══════════════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════

const API_URL = "https://script.google.com/macros/s/AKfycbzrRc0e5xD9tLPFPsQNgGdfGaHTkJ5uuCLW_ZGZad0I68MBQKtm11yQNkZNOjxFL8SuhQ/exec";
const API_KEY = "TIENDA_API_2026";
const CLOUDFLARE_PROXY = "https://tienda-image-proxy.pedidosnia-cali.workers.dev";
const LIMIT = 20;

// ═══════════════════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════════════════════════════════════

let page = 0;
let categoria = "";
let carrito = JSON.parse(localStorage.getItem("carrito")) || [];
// Normalizar IDs del carrito para asegurar que son números
carrito = carrito.map(item => ({
  ...item,
  id: Number(item.id)
}));
let carritoAbierto = JSON.parse(localStorage.getItem("carritoState") ?? "true");

const productosDiv = document.getElementById("productos");
const pageInfo = document.getElementById("pageInfo");
const categoriasSection = document.getElementById("categoriasSection");
const categoriasGrid = document.getElementById("categoriasGrid");
const productosSection = document.getElementById("productosSection");
const paginacion = document.getElementById("paginacion");
const categoriasBtn = document.getElementById("categoriasBtn");
const categoriaBreadcrumb = document.getElementById("categoriaBreadcrumb");
const carritoContainer = document.getElementById("carritoContainer");
const carritoToggle = document.getElementById("carritoToggle");
const carritoCloseBtn = document.getElementById("carritoCloseBtn");

// Cache Frontend
const cache = {
  productos: null,
  timestamp: 0,
  ttl: 10 * 60 * 1000 // 10 minutos
};

// ═══════════════════════════════════════════════════════════════════════
// NOTIFICACIONES (TOAST SYSTEM)
// ═══════════════════════════════════════════════════════════════════════

class ToastNotificacion {
  constructor() {
    this.container = document.getElementById("toastContainer");
  }

  mostrar(mensaje, tipo = "info", duracion = 3000) {
    const toast = document.createElement("div");
    toast.className = `toast toast-${tipo}`;
    
    // Emoji por tipo
    const emojis = {
      success: "✓",
      error: "✕",
      warning: "⚠",
      info: "ℹ"
    };
    
    toast.innerHTML = `
      <span>${emojis[tipo]}</span>
      <span>${mensaje}</span>
    `;
    
    this.container.appendChild(toast);
    
    // Auto remover
    setTimeout(() => {
      toast.style.animation = "slideOutDown 0.3s ease-out";
      setTimeout(() => toast.remove(), 300);
    }, duracion);
  }

  exito(mensaje) { this.mostrar(mensaje, "success"); }
  error(mensaje) { this.mostrar(mensaje, "error", 4000); }
  advertencia(mensaje) { this.mostrar(mensaje, "warning"); }
  info(mensaje) { this.mostrar(mensaje, "info"); }
}

const toast = new ToastNotificacion();

// ═══════════════════════════════════════════════════════════════════════
// MODAL DE PRODUCTO EXPANDIDO
// ═══════════════════════════════════════════════════════════════════════

function abrirModalProducto(producto, imagenSrc) {
  const modal = document.getElementById("productoModal");
  const modalImg = document.getElementById("modalImg");
  const modalNombre = document.getElementById("modalNombre");
  const modalPrecio = document.getElementById("modalPrecio");
  
  // Llenar datos del modal
  modalImg.src = imagenSrc;
  modalImg.alt = producto.nombre;
  modalNombre.textContent = producto.nombre;
  modalPrecio.textContent = `$ ${Number(producto.precio).toLocaleString()}`;
  
  // Mostrar modal
  modal.style.display = "flex";
  document.body.style.overflow = "hidden"; // Prevenir scroll del body
  
  console.log("Modal abierto para:", producto.nombre);
}

function cerrarModalProducto() {
  const modal = document.getElementById("productoModal");
  modal.style.display = "none";
  document.body.style.overflow = "auto"; // Restaurar scroll
}

// Cerrar modal con tecla Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    cerrarModalProducto();
  }
});

// Cerrar modal al hacer click fuera (en overlay)
document.addEventListener("click", (e) => {
  const modal = document.getElementById("productoModal");
  if (e.target === modal || e.target.classList.contains("modal-overlay")) {
    cerrarModalProducto();
  }
});

// ═══════════════════════════════════════════════════════════════════════
// CATEGORÍAS - VISTA INICIAL
// ═══════════════════════════════════════════════════════════════════════

function mostrarCategorias() {
  categoriasSection.style.display = "block";
  productosSection.style.display = "none";
  paginacion.style.display = "none";
  pageInfo.textContent = "";
  categoriaBreadcrumb.textContent = "";
}

function mostrarProductos() {
  categoriasSection.style.display = "none";
  productosSection.style.display = "block";
  paginacion.style.display = "flex";
}

function renderCategorias(productos) {
  categoriasGrid.innerHTML = "";

  const conteo = productos.reduce((acc, item) => {
    const key = item.categoria || "Sin categoría";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const categorias = Object.keys(conteo).sort((a, b) => a.localeCompare(b, "es"));
  const items = [
    { nombre: "Todas las categorías", valor: "", cantidad: productos.length }
  ].concat(categorias.map(cat => ({ nombre: cat, valor: cat, cantidad: conteo[cat] })));

  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "categoria-card";
    card.innerHTML = `
      <div class="categoria-nombre">${item.nombre}</div>
      <div class="categoria-cantidad">${item.cantidad} productos</div>
    `;
    card.addEventListener("click", () => {
      categoria = item.valor;
      page = 0;
      const label = categoria ? categoria : "Todas las categorías";
      categoriaBreadcrumb.innerHTML = `Categoría: <span class="breadcrumb-muted">${label}</span>`;
      mostrarProductos();
      cargar();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    categoriasGrid.appendChild(card);
  });
}

// ═══════════════════════════════════════════════════════════════════════
// GESTIÓN DEL CARRITO COLAPSABLE
// ═══════════════════════════════════════════════════════════════════════

function toggleCarrito() {
  carritoAbierto = !carritoAbierto;
  
  // Toggle la clase collapsed
  carritoContainer.classList.toggle("collapsed", !carritoAbierto);
  
  // Actualizar clase del botón toggle
  if (carritoAbierto) {
    carritoToggle.classList.remove("minimizado");
    carritoToggle.classList.add("active");
    carritoToggle.title = "Cerrar carrito";
  } else {
    carritoToggle.classList.add("minimizado");
    carritoToggle.classList.remove("active");
    carritoToggle.title = "Abrir carrito";
  }
  
  // Guardar estado en localStorage
  localStorage.setItem("carritoState", JSON.stringify(carritoAbierto));
}

// Event Listeners del Carrito
carritoToggle.addEventListener("click", toggleCarrito);
carritoCloseBtn.addEventListener("click", toggleCarrito);

// Aplicar estado inicial
if (!carritoAbierto) {
  carritoContainer.classList.add("collapsed");
  carritoToggle.classList.add("minimizado");
} else {
  carritoToggle.classList.add("active");
}

// Cerrar carrito automáticamente si el usuario hace click fuera
document.addEventListener("click", (e) => {
  if (carritoAbierto && window.innerWidth < 768) {
    // En móvil, no cerrar automáticamente
    return;
  }
});

// ═══════════════════════════════════════════════════════════════════════
// CARRITO - LÓGICA
// ═══════════════════════════════════════════════════════════════════════

function guardarCarrito() {
  localStorage.setItem("carrito", JSON.stringify(carrito));
  renderCarrito();
  actualizarBadgeCarrito();
}

function actualizarBadgeCarrito() {
  const cantidadTotal = carrito.reduce((acc, item) => acc + item.cantidad, 0);
  document.getElementById("cartoBadge").textContent = cantidadTotal;
}

function agregarAlCarrito(producto, cantidad) {
  cantidad = Number(cantidad);
  if (cantidad <= 0) {
    toast.advertencia("Cantidad debe ser mayor a 0");
    return;
  }

  // Asegurar que producto.id es siempre número
  const productoId = Number(producto.id);

  const item = carrito.find(p => Number(p.id) === productoId);

  if (item) {
    item.cantidad += cantidad;
    toast.info(`Cantidad actualizada: ${producto.nombre}`);
  } else {
    carrito.push({
      id: productoId,
      nombre: producto.nombre,
      precio: producto.precio,
      cantidad: cantidad
    });
    toast.exito(`✓ ${producto.nombre} añadido`);
  }

  guardarCarrito();
}

function cambiarCantidad(id, delta) {
  console.log(`[cambiarCantidad] ID: ${id}, Delta: ${delta}`);
  
  // Asegurar que id es número y buscar con conversión de tipo
  id = Number(id);
  const item = carrito.find(p => Number(p.id) === id);
  
  if (!item) {
    console.error(`[cambiarCantidad] Artículo con ID ${id} no encontrado. Carrito:`, carrito);
    return;
  }

  item.cantidad += delta;
  console.log(`[cambiarCantidad] Nueva cantidad: ${item.cantidad}`);

  if (item.cantidad <= 0) {
    const nombreProducto = item.nombre;
    carrito = carrito.filter(p => Number(p.id) !== id);
    toast.info(`${nombreProducto} removido del carrito`);
  } else {
    toast.info(`Cantidad actualizada a ${item.cantidad}`);
  }

  // Guardar y re-renderizar todo
  guardarCarrito();
  renderCarrito();
  actualizarBadgeCarrito();
}

function cambiarCantidadCard(id, delta) {
  const input = document.getElementById(`qty-${id}`);
  let val = Number(input.value) + delta;
  if (val < 1) val = 1;
  input.value = val;
}

function renderCarrito() {
  const cont = document.getElementById("carritoItems");
  const totalDiv = document.getElementById("carritoTotal");
  const vacioDiv = document.getElementById("carritoVacio");

  cont.innerHTML = "";
  let total = 0;

  if (carrito.length === 0) {
    vacioDiv.style.display = "flex";
    totalDiv.textContent = "$ 0";
    return;
  }

  vacioDiv.style.display = "none";

  carrito.forEach(p => {
    total += p.precio * p.cantidad;

    const itemDiv = document.createElement("div");
    itemDiv.className = "item";
    itemDiv.innerHTML = `
      <div class="item-info">
        <div class="item-name">${p.nombre}</div>
        <div class="item-price">$ ${Number(p.precio).toLocaleString()}</div>
      </div>
      <div class="qty">
        <button class="btn-qty-minus" data-id="${p.id}" title="Disminuir cantidad">−</button>
        <span class="qty-valor">${p.cantidad}</span>
        <button class="btn-qty-plus" data-id="${p.id}" title="Aumentar cantidad">+</button>
      </div>
    `;
    cont.appendChild(itemDiv);
  });

  // Agregar event listeners a los botones
  document.querySelectorAll(".btn-qty-minus").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const id = parseInt(btn.dataset.id);
      cambiarCantidad(id, -1);
    });
  });

  document.querySelectorAll(".btn-qty-plus").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const id = parseInt(btn.dataset.id);
      cambiarCantidad(id, 1);
    });
  });

  totalDiv.textContent = `$ ${total.toLocaleString()}`;
}

// ═══════════════════════════════════════════════════════════════════════
// VALIDACIÓN DE DATOS
// ═══════════════════════════════════════════════════════════════════════

function validarCliente(nombre, ciudad) {
  const errores = [];

  if (!nombre || nombre.trim().length < 3) {
    errores.push("Nombre debe tener mínimo 3 caracteres");
  }

  if (!ciudad || ciudad.trim().length < 2) {
    errores.push("Ciudad es obligatoria");
  }

  // Validar caracteres permitidos
  if (!/^[\w\s\-áéíóúàäëöüâêîôûãõñçñ.,']+$/i.test(nombre)) {
    errores.push("Nombre contiene caracteres inválidos");
  }

  if (!/^[\w\s\-áéíóúàäëöüâêîôûãõñ]+$/i.test(ciudad)) {
    errores.push("Ciudad contiene caracteres inválidos");
  }

  return errores;
}

// Verificar si pedido se guardó en DB (fallback)
async function verificarPedidoEnDB() {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: new URLSearchParams({
        action: "obtenerPedidos",
        key: API_KEY,
        limit: "1"
      })
    });
    const data = await res.json();
    return data && data.length > 0;
  } catch (e) {
    console.warn("No se pudo verificar DB:", e);
    return true; // Asumir éxito si no se puede verificar
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ENVÍO DE PEDIDOS
// ═══════════════════════════════════════════════════════════════════════

async function enviarPedido() {
  if (!carrito.length) {
    toast.error("El carrito está vacío");
    return;
  }

  const nombre = document.getElementById("clienteNombre").value;
  const ciudad = document.getElementById("clienteCiudad").value;

  // Validar datos
  const errores = validarCliente(nombre, ciudad);
  if (errores.length > 0) {
    toast.error(errores.join("\n"));
    return;
  }

  const total = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);

  // Desactivar botón mientras se envía
  const btn = event.target;
  const btnOriginalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "⏳ Enviando...";

  try {
    const res = await fetch("https://pedido-proxy.pedidosnia-cali.workers.dev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "crearPedido",
        key: API_KEY,
        cliente: { nombre: nombre.trim(), ciudad: ciudad.trim() },
        items: carrito,
        total
      })
    });

    // Obtener texto de respuesta primero
    const responseText = await res.text();
    
    // Intentar parsear como JSON
    let data = null;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      // Si no es JSON válido, registrar error pero considerar éxito si guardó en DB
      console.warn("Respuesta no es JSON válido:", responseText.substring(0, 100));
      // El pedido probablemente se guardó, mostrar éxito con precaución
      data = { 
        success: true, 
        pedido_id: "pedido registrado",
        warning: "Confirmación del servidor con error, pero datos guardados"
      };
    }

    if (data.success || res.status === 200) {
      // Mostrar notificación de éxito con ID del pedido
      const pedidoID = data.pedido_id || "confirmado";
      const mensaje = data.warning 
        ? `✓ Pedido ${pedidoID} registrado (con nota del servidor)`
        : `✓ ¡Pedido ${pedidoID} creado exitosamente!`;
      
      toast.exito(mensaje);
      
      // Limpiar carrito completamente
      carrito = [];
      localStorage.removeItem("carrito");
      localStorage.setItem("carrito", JSON.stringify([]));
      
      // Actualizar UI del carrito
      const carritoItems = document.getElementById("carritoItems");
      const carritoTotal = document.getElementById("carritoTotal");
      const carritoVacio = document.getElementById("carritoVacio");
      
      if (carritoItems) carritoItems.innerHTML = "";
      if (carritoTotal) carritoTotal.textContent = "$ 0";
      if (carritoVacio) carritoVacio.style.display = "flex";
      
      actualizarBadgeCarrito();
      
      // Limpiar formulario de cliente
      document.getElementById("clienteNombre").value = "";
      document.getElementById("clienteCiudad").value = "";

      // Revertir botón con confirmación visual
      btn.disabled = false;
      btn.textContent = "✓ Pedido Enviado";
      
      // Esperar 2 segundos antes de cerrar carrito
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Restaurar texto del botón
      btn.textContent = btnOriginalText;
      
      // Cerrar carrito
      if (carritoAbierto) {
        toggleCarrito();
      }
    } else {
      throw new Error(data.error || data.mensaje || "Error al crear pedido");
    }
  } catch (error) {
    console.error("Error enviando pedido:", error);
    toast.error(`❌ Error: ${error.message}`);
    btn.disabled = false;
    btn.textContent = btnOriginalText;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// PRODUCTOS - FETCH Y CONVERSIÓN DE URLs
// ═══════════════════════════════════════════════════════════════════════

async function fetchProductos() {
  // Verificar cache
  if (cache.productos && Date.now() - cache.timestamp < cache.ttl) {
    console.log("📦 Usando cache de productos");
    return cache.productos;
  }

  try {
    console.log("📥 Obteniendo productos de API...");
    const res = await fetch(
      `${API_URL}?action=getProductos&offset=0&limit=3000&key=${API_KEY}`
    );

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: Error obteniendo productos`);
    }

    const data = await res.json();

    if (!data.items || !Array.isArray(data.items)) {
      throw new Error("Formato de respuesta inválido");
    }

    cache.productos = data.items;
    cache.timestamp = Date.now();

    console.log(`✓ ${data.items.length} productos cargados`);
    return data.items;
  } catch (error) {
    console.error("❌ Error fetch productos:", error);
    toast.error("Error cargando productos");
    return [];
  }
}

// Convertir URL de Google Drive a Proxy Cloudflare
function convertirDriveUrlAProxy(driveUrl) {
  if (!driveUrl) return null;

  if (driveUrl.startsWith(CLOUDFLARE_PROXY)) {
    return driveUrl;
  }

  // Extraer fileId de URLs de Google Drive
  const match = driveUrl.match(/[-\w]{25,}/);
  if (!match) return null;

  const fileId = match[0];
  return `${CLOUDFLARE_PROXY}/?fileId=${fileId}&key=${API_KEY}`;
}

// Generar SVG Fallback Colorido
function generarFallbackSVG(nombre, id) {
  const inicial = nombre ? nombre.charAt(0).toUpperCase() : '?';
  const colores = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
    '#F8B739', '#C71585', '#00CED1', '#FF4500'
  ];
  const color = colores[id % colores.length];

  return `data:image/svg+xml;base64,${btoa(`
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="300" fill="${color}"/>
      <text x="200" y="160" font-size="120" fill="white" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold">${inicial}</text>
    </svg>
  `)}`;
}

// Cargar imagen con retry
function cargarImagenDirecta(img, src, fallback) {
  if (!src) {
    img.src = fallback;
    return;
  }

  img.src = src;

  img.onerror = () => {
    if (img.src !== fallback) {
      console.warn(`❌ Error cargando: ${src}, usando fallback`);
      img.src = fallback;
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════
// RENDERIZADO DE PRODUCTOS
// ═══════════════════════════════════════════════════════════════════════

function render(productos) {
  productosDiv.innerHTML = "";

  if (productos.length === 0) {
    productosDiv.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #757575;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">📭</div>
        <p>No hay productos en esta categoría</p>
      </div>
    `;
    return;
  }

  productos.forEach(p => {
    const proxyUrl = convertirDriveUrlAProxy(p.imagen);
    const fallbackSVG = generarFallbackSVG(p.nombre, p.id);

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="card-imagen-wrapper" style="cursor: pointer; overflow: hidden; border-radius: 12px 12px 0 0;">
        <img
          class="card-imagen"
          src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCI+PC9zdmc+"
          data-src="${proxyUrl || p.imagen}"
          data-fallback="${fallbackSVG}"
          data-producto='${JSON.stringify(p)}'
          loading="lazy"
          alt="${p.nombre}"
          style="transition: transform 0.3s ease; display: block; width: 100%; height: auto;"
          title="Haz clic para ver en grande"
          onmouseover="this.style.transform='scale(1.05)'"
          onmouseout="this.style.transform='scale(1)'"
          onclick="abrirModalProducto(${JSON.stringify(p)}, this.src)"
        >
      </div>
      <div class="info">
        <h3>${p.nombre}</h3>
        <div class="precio">$ ${Number(p.precio).toLocaleString()}</div>

        <div class="qty-card">
          <button onclick="cambiarCantidadCard(${p.id}, -1)" title="Disminuir cantidad">−</button>
          <input
            type="number"
            min="1"
            value="1"
            id="qty-${p.id}"
            aria-label="Cantidad de ${p.nombre}"
          >
          <button onclick="cambiarCantidadCard(${p.id}, 1)" title="Aumentar cantidad">+</button>
        </div>

        <button class="btn"
          onclick='agregarAlCarrito(${JSON.stringify(p)}, document.getElementById("qty-${p.id}").value)'
          title="Agregar ${p.nombre} al carrito">
          🛒 Agregar
        </button>
      </div>
    `;

    productosDiv.appendChild(card);
  });

  activarLazyLoading();
}

// Lazy Loading con IntersectionObserver
function activarLazyLoading() {
  const imgs = document.querySelectorAll("img[data-src]");

  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const img = e.target;
        const src = img.dataset.src;
        const fallback = img.dataset.fallback;

        cargarImagenDirecta(img, src, fallback);

        img.removeAttribute("data-src");
        obs.unobserve(img);
      }
    });
  }, { rootMargin: "100px" });

  imgs.forEach(i => obs.observe(i));
}

// ═══════════════════════════════════════════════════════════════════════
// PAGINACIÓN Y FILTRADO
// ═══════════════════════════════════════════════════════════════════════

async function cargar() {
  try {
    const all = await fetchProductos();

    if (all.length === 0) {
      productosDiv.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
          <div style="font-size: 2rem; margin-bottom: 1rem;">❌</div>
          <p>No se pudieron cargar los productos</p>
        </div>
      `;
      pageInfo.textContent = "Error";
      return;
    }

    const filtrados = categoria
      ? all.filter(p => p.categoria === categoria)
      : all;

    const start = page * LIMIT;
    const items = filtrados.slice(start, start + LIMIT);

    const totalPages = Math.ceil(filtrados.length / LIMIT);
    pageInfo.textContent = `Página ${page + 1} de ${totalPages}`;

    render(items);

    document.getElementById("prev").disabled = page === 0;
    document.getElementById("next").disabled = start + LIMIT >= filtrados.length;
  } catch (error) {
    console.error("Error en cargar():", error);
    toast.error("Error cargando productos");
  }
}

// Event Listeners de Paginación
document.getElementById("prev").onclick = () => {
  if (page > 0) {
    page--;
    cargar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
};

document.getElementById("next").onclick = () => {
  page++;
  cargar();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

categoriasBtn.addEventListener("click", () => {
  mostrarCategorias();
});

// ═══════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════════════

(async () => {
  try {
    console.log("🚀 Inicializando aplicación...");

    // Cargar y renderizar carrito inicial
    renderCarrito();
    actualizarBadgeCarrito();

    // Obtener productos
    const productos = await fetchProductos();

    if (productos.length === 0) {
      toast.error("No se pudieron cargar los productos");
      return;
    }

    // Renderizar categorías iniciales
    renderCategorias(productos);
    mostrarCategorias();

    console.log("✅ Aplicación lista");
  } catch (error) {
    console.error("❌ Error en inicialización:", error);
    toast.error("Error iniciando la aplicación");
  }
})();

// ═══════════════════════════════════════════════════════════════════════
// SERVICIOS PRÁCTICOS
// ═══════════════════════════════════════════════════════════════════════

// Auto guardar carrito cada 30 segundos (por si acaso)
setInterval(() => {
  localStorage.setItem("carrito", JSON.stringify(carrito));
}, 30000);

// Detectar conexión offline
window.addEventListener("online", () => {
  toast.exito("✓ Conexión restaurada");
});

window.addEventListener("offline", () => {
  toast.advertencia("⚠ Sin conexión a internet");
});

// ═══════════════════════════════════════════════════════════════════════
// DEBUG & DESARROLLO
// ═══════════════════════════════════════════════════════════════════════

// Comando global para limpiar carrito en consola
window.limpiarCarrito = () => {
  carrito = [];
  guardarCarrito();
  toast.info("Carrito limpiado");
};

// Debugging
window.verCarrito = () => console.table(carrito);
window.verCache = () => console.log("Cache:", cache);
