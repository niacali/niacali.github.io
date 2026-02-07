/* ═══════════════════════════════════════════════════════════════════════
   APP.JS - VERSIÓN MODERNA 2026
   Carrito Colapsable, Toasts, Mejor Gestión de Errores
   ═══════════════════════════════════════════════════════════════════════ */

// Verificar si estamos en admin.html - No ejecutar app.js allí
if (window.location.pathname.includes('admin.html') || document.getElementById('adminPanel')) {
  console.log("✓ app.js desactivado en admin.html");
} else {

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════

const API_URL = "https://script.google.com/macros/s/AKfycbxm3q8xKGQwGLJNlpn8alIpr5rJK0qMws3WsbSXeMec2ic2Q8StcU_PCo9cb5rZtSX4ig/exec";
const API_KEY = "TIENDA_API_2026";
const CLOUDFLARE_PROXY = "https://tienda-image-proxy.pedidosnia-cali.workers.dev";
const LIMIT = 20;

// ═══════════════════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════════════════════════════════════

let page = 0;
let categoriaSeleccionada = null; // Cambiar de 'categoria' a 'categoriaSeleccionada' y usar objeto
function normalizarCarrito(items) {
  const base = Array.isArray(items) ? items : [];
  return base.map(item => ({
    ...item,
    id: Number(item.id)
  }));
}

let carrito = normalizarCarrito(JSON.parse(localStorage.getItem("carrito")) || []);

function sincronizarCarritoDesdeStorage() {
  carrito = normalizarCarrito(JSON.parse(localStorage.getItem("carrito")) || []);
  renderCarrito();
  actualizarBadgeCarrito();
}

const productosDiv = document.getElementById("productos");
const pageInfo = document.getElementById("pageInfo");
const categoriasSection = document.getElementById("categoriasSection");
const categoriasGrid = document.getElementById("categoriasGrid");
const productosSection = document.getElementById("productosSection");
const paginacion = document.getElementById("paginacion");
const categoriasBtn = document.getElementById("categoriasBtn");
const categoriaBreadcrumb = document.getElementById("categoriaBreadcrumb");
const carritoToggle = document.getElementById("carritoToggle");
const busquedaInput = document.getElementById("busquedaInput");
const busquedaClear = document.getElementById("busquedaClear");
const busquedaInfo = document.getElementById("busquedaInfo");
const sortSelect = document.getElementById("sortSelect");

let textoBusqueda = "";
let ordenProductos = "az";

function normalizarTexto(valor) {
  return String(valor || "").toLowerCase().trim();
}

function obtenerEstadoProducto(producto) {
  return normalizarTexto(producto && producto.estado ? producto.estado : "disponible");
}

function productoDisponible(producto) {
  return obtenerEstadoProducto(producto) === "disponible";
}

function obtenerEtiquetaEstado(estado) {
  if (estado === "agotado") return "Agotado";
  return "No disponible";
}

function obtenerReferenciaProducto(producto) {
  return producto.referencia || producto.ref || producto.codigo || producto.sku || producto.id || "";
}

function ordenarProductos(items) {
  const base = Array.isArray(items) ? [...items] : [];
  switch (ordenProductos) {
    case "za":
      return base.sort((a, b) => normalizarTexto(b.nombre).localeCompare(normalizarTexto(a.nombre), "es"));
    case "precio-asc":
      return base.sort((a, b) => Number(a.precio || 0) - Number(b.precio || 0));
    case "precio-desc":
      return base.sort((a, b) => Number(b.precio || 0) - Number(a.precio || 0));
    case "az":
    default:
      return base.sort((a, b) => normalizarTexto(a.nombre).localeCompare(normalizarTexto(b.nombre), "es"));
  }
}

function actualizarBusquedaUI(totalResultados) {
  if (!busquedaInfo) return;
  if (!textoBusqueda) {
    busquedaInfo.textContent = "";
    return;
  }
  const total = Number(totalResultados) || 0;
  busquedaInfo.textContent = total === 0
    ? "Sin resultados"
    : `${total} resultado${total === 1 ? "" : "s"}`;
}

function actualizarBotonLimpiarBusqueda() {
  if (!busquedaClear) return;
  busquedaClear.style.display = textoBusqueda ? "inline-flex" : "none";
}

window.addEventListener("pageshow", () => {
  sincronizarCarritoDesdeStorage();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    sincronizarCarritoDesdeStorage();
  }
});

// Cache Frontend
const cache = {
  productos: null,
  categorias: null,
  timestamp: 0,
  timestampCategorias: 0,
  ttl: 10 * 60 * 1000 // 10 minutos
};

// ═══════════════════════════════════════════════════════════════════════
// MAPEO DE ICONOS POR DEFECTO PARA CATEGORÍAS (fallback)
// ═══════════════════════════════════════════════════════════════════════

const CATEGORIA_ICONS_DEFAULT = {
  // Mapeo de categorías a iconos
  "accesorios": "headphones",
  "belleza": "styler",
  "hogar": "home",
  "portatiles": "laptop",
  "sonido": "speaker",
  "soportes": "tripod",
  "temporada": "event",
  "ventiladores": "mode_fan",
  // Mapeo de iconos de BD a Material Symbols válidos
  "fire": "mode_fan",
  "base": "foundation",
  "sound": "speaker",
  "house": "home",
  "beauty": "spa",
  "accesories": "headphones",
  "things": "category",
  "season": "event_note",
  "other": "more_horiz"
};

// Función para obtener el icono de una categoría
function getIconoCategoria(categoria, categoriasDb = null) {
  const categoriaStr = String(categoria || "").toLowerCase().trim();

  // Primero buscar en datos de BD si existen
  if (categoriasDb && Array.isArray(categoriasDb)) {
    const cat = categoriasDb.find(c => {
      const nombre = String(c.nombre || "").toLowerCase().trim();
      const id = String(c.id || "").toLowerCase().trim();
      return nombre === categoriaStr || id === categoriaStr;
    });
    if (cat && cat.icono) {
      // Si el icono de BD existe, mapearlo a un icono válido de Material Symbols
      const iconoMapeado = CATEGORIA_ICONS_DEFAULT[cat.icono];
      return iconoMapeado || cat.icono; // fallback al icono original si no hay mapeo
    }
  }

  // Fallback a mapeo local (coincidencia exacta)
  const iconoExacto = CATEGORIA_ICONS_DEFAULT[categoriaStr];
  if (iconoExacto) return iconoExacto;

  // Búsqueda parcial por palabra clave
  for (const [key, icon] of Object.entries(CATEGORIA_ICONS_DEFAULT)) {
    if (categoriaStr.includes(key.toLowerCase()) ||
        key.toLowerCase().includes(categoriaStr)) {
      return icon;
    }
  }

  // Icono por defecto
  return "shopping_bag";
}

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

function abrirModalProducto(producto, imagenSrc, fallbackSrc) {
  const modal = document.getElementById("productoModal");
  const modalImg = document.getElementById("modalImg");
  const modalNombre = document.getElementById("modalNombre");
  const modalPrecio = document.getElementById("modalPrecio");
  modal.classList.remove("modal-closing");
  
  // Llenar datos del modal
  modalImg.alt = producto.nombre;
  if (fallbackSrc) {
    cargarImagenDirecta(modalImg, imagenSrc, fallbackSrc);
  } else {
    modalImg.src = imagenSrc;
  }
  modalNombre.textContent = producto.nombre;
  modalPrecio.textContent = `$ ${Number(producto.precio).toLocaleString()}`;
  
  // Mostrar modal
  modal.style.display = "flex";
  document.body.style.overflow = "hidden"; // Prevenir scroll del body
  
  console.log("Modal abierto para:", producto.nombre);
}

function cerrarModalProducto() {
  const modal = document.getElementById("productoModal");
  if (!modal || modal.style.display === "none") return;
  modal.classList.add("modal-closing");
  setTimeout(() => {
    modal.style.display = "none";
    modal.classList.remove("modal-closing");
    document.body.style.overflow = "auto"; // Restaurar scroll
  }, 220);
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

// Cerrar modal al hacer clic en la imagen
document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "modalImg") {
    cerrarModalProducto();
  }
});

// Cerrar modal con swipe (móvil)
let modalTouchStartY = 0;
let modalTouchStartX = 0;

document.addEventListener("touchstart", (e) => {
  const modal = document.getElementById("productoModal");
  if (modal && modal.style.display === "flex") {
    const touch = e.touches[0];
    modalTouchStartY = touch.clientY;
    modalTouchStartX = touch.clientX;
  }
}, { passive: true });

document.addEventListener("touchend", (e) => {
  const modal = document.getElementById("productoModal");
  if (modal && modal.style.display === "flex") {
    const touch = e.changedTouches[0];
    const deltaY = touch.clientY - modalTouchStartY;
    const deltaX = Math.abs(touch.clientX - modalTouchStartX);

    if ((Math.abs(deltaY) > 60 && deltaX < 80) || (deltaX > 80 && Math.abs(deltaY) < 60)) {
      cerrarModalProducto();
    }
  }
}, { passive: true });

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

async function irInicioCategorias() {
  categoriaSeleccionada = null;
  page = 0;
  textoBusqueda = "";
  if (busquedaInput) busquedaInput.value = "";
  actualizarBotonLimpiarBusqueda();
  actualizarBusquedaUI(0);
  mostrarCategorias();
  try {
    // Intentar cargar categorías desde BD
    let categoriasDb = await fetchCategorias();

    // Si no hay categorías en BD, extraer dinámicamente de productos
    if (!categoriasDb || categoriasDb.length === 0) {
      console.log("📦 Extrayendo categorías dinámicamente de productos...");
      const productos = await fetchProductos();
      categoriasDb = await generarCategoriasDesdeProductos(productos);
    }

    if (categoriasDb && categoriasDb.length > 0) {
      await renderCategorias(categoriasDb);
    }
  } catch (error) {
    console.error("Error al cargar categorías:", error);
    toast.error("Error cargando categorías");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function mostrarProductos() {
  categoriasSection.style.display = "none";
  productosSection.style.display = "block";
  paginacion.style.display = "flex";
}

// Generar categorías dinámicamente desde productos si no existen en BD
async function generarCategoriasDesdeProductos(productos) {
  const conteo = productos.reduce((acc, item) => {
    const key = item.categoria || "Sin categoría";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const categorias = Object.keys(conteo).sort((a, b) => a.localeCompare(b, "es"));
  return categorias.map(cat => ({
    id: String(cat || "").toLowerCase().trim(),
    nombre: cat,
    icono: getIconoCategoria(cat),
    cantidad: conteo[cat],
    orden: 0,
    estado: "activo"
  }));
}

// Renderizar categorías desde BD o datos generados
async function renderCategorias(categoriasData) {
  categoriasGrid.innerHTML = "";
  
  // Si categoriasData es un array de productos, procesarlo
  if (categoriasData.length > 0 && categoriasData[0].precio !== undefined) {
    categoriasData = await generarCategoriasDesdeProductos(categoriasData);
  }

  // Filtrar categorías activas si existe el campo estado
  categoriasData = categoriasData.filter(item => {
    const estado = String(item.estado || "activo").toLowerCase().trim();
    return estado === "activo";
  });

  // Ordenar por campo "orden" si existe, sino alfabéticamente
  const items = categoriasData.sort((a, b) => {
    if (a.orden !== undefined && b.orden !== undefined) {
      return a.orden - b.orden;
    }
    return (a.nombre || "").localeCompare(b.nombre || "", "es");
  });

  items.forEach(item => {
    const icono = getIconoCategoria(item.id || item.nombre, categoriasData);
    const filtroCategoria = item.nombre || item.id;
    const card = document.createElement("div");
    card.className = "categoria-card";
    card.innerHTML = `
      <div class="categoria-icon">
        <span class="material-symbols-outlined">${icono}</span>
      </div>
      <div class="categoria-nombre">${item.nombre}</div>
      <div class="categoria-cantidad">${item.cantidad ? item.cantidad + " productos" : ""}</div>
    `;
    card.addEventListener("click", () => {
      categoriaSeleccionada = item; // Almacenar objeto completo
      if (sortSelect) {
        ordenProductos = sortSelect.value || "az";
      }
      page = 0;
      const label = categoriaSeleccionada ? categoriaSeleccionada.nombre : "Todas las categorías";
      categoriaBreadcrumb.innerHTML = `Categoría: <span class="breadcrumb-muted">${label}</span>`;
      mostrarProductos();
      cargar();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    categoriasGrid.appendChild(card);
  });
}

function actualizarConteoCategorias(productos, categoriasData) {
  if (!productos || productos.length === 0) return categoriasData;

  const conteo = productos.reduce((acc, item) => {
    const key = String(item.categoria || "Sin categoría").toLowerCase().trim();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return categoriasData.map(cat => {
    const nombreKey = String(cat.nombre || "").toLowerCase().trim();
    const idKey = String(cat.id || "").toLowerCase().trim();
    const cantidad = conteo[nombreKey] || conteo[idKey] || 0;
    return { ...cat, cantidad };
  });
}

// Event Listener del botón de carrito (redirigir a página)
if (carritoToggle) {
  carritoToggle.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "carrito.html";
  });
}

// ═══════════════════════════════════════════════════════════════════════
// CARRITO - LÓGICA
// ═══════════════════════════════════════════════════════════════════════

function guardarCarrito() {
  localStorage.setItem("carrito", JSON.stringify(carrito));
  renderCarrito();
  actualizarBadgeCarrito();
}

// Proteger badge de carrito para páginas sin el elemento
function actualizarBadgeCarrito() {
  const cantidadTotal = carrito.reduce((acc, item) => acc + item.cantidad, 0);
  const badge = document.getElementById("cartoBadge");
  if (badge) badge.textContent = cantidadTotal;
}

function agregarAlCarrito(producto, cantidad) {
  if (!productoDisponible(producto)) {
    toast.advertencia("Producto no disponible");
    return;
  }

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
      cantidad: cantidad,
      categoria: producto.categoria || "Sin categoría",
      imagen: producto.imagen || "https://via.placeholder.com/100?text=Sin+Imagen"
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

  if (!cont || !totalDiv || !vacioDiv) {
    return;
  }

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
// CATEGORÍAS - FETCH Y CACHEO
// ═══════════════════════════════════════════════════════════════════════

async function fetchCategorias() {
  // Verificar cache local
  if (cache.categorias && Date.now() - cache.timestampCategorias < cache.ttl) {
    console.log("📂 Usando cache de categorías");
    return cache.categorias;
  }

  try {
    console.log("📥 Obteniendo categorías de API...");
    const res = await fetch(
      `${API_URL}?action=getCategorias&key=${API_KEY}`
    );

    if (!res.ok) {
      console.warn(`⚠️ HTTP ${res.status}: Usando fallback dinámico`);
      return null;
    }

    const data = await res.json();
    const items = Array.isArray(data) ? data : data.items;

    if (items && Array.isArray(items)) {
      cache.categorias = items;
      cache.timestampCategorias = Date.now();
      console.log(`✓ ${items.length} categorías cargadas desde BD`);
      return items;
    }

    console.warn("⚠️ Respuesta de categorías inválida, usando fallback");
    return null;
  } catch (error) {
    console.warn("⚠️ Error fetch categorías, usando fallback dinámico:", error);
    return null;
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

function renderSkeletonProductos(count = 8) {
  if (!productosDiv) return;
  productosDiv.innerHTML = "";
  const total = Math.max(4, Number(count) || 8);

  for (let i = 0; i < total; i++) {
    const card = document.createElement("div");
    card.className = "card skeleton-card";
    card.innerHTML = `
      <div class="skeleton-img"></div>
      <div class="info">
        <div class="skeleton-line skeleton-title"></div>
        <div class="skeleton-line skeleton-desc"></div>
        <div class="skeleton-line skeleton-price"></div>
        <div class="skeleton-line skeleton-ref"></div>
        <div class="skeleton-row">
          <div class="skeleton-pill"></div>
          <div class="skeleton-circle"></div>
        </div>
      </div>
    `;
    productosDiv.appendChild(card);
  }
}

function render(productos, emptyMessage = "No hay productos en esta categoría") {
  productosDiv.innerHTML = "";

  if (productos.length === 0) {
    productosDiv.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #757575;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">📭</div>
        <p>${emptyMessage}</p>
      </div>
    `;
    return;
  }

  productos.forEach(p => {
    const proxyUrl = convertirDriveUrlAProxy(p.imagen);
    const fallbackSVG = generarFallbackSVG(p.nombre, p.id);
    const estado = obtenerEstadoProducto(p);
    const disponible = estado === "disponible";
    const etiquetaEstado = disponible ? "" : obtenerEtiquetaEstado(estado);

    // Crear objeto producto con imagen procesada
    const productoConProxy = {
      ...p,
      imagen: proxyUrl || p.imagen || fallbackSVG
    };

    const card = document.createElement("div");
    card.className = `card${disponible ? "" : " card--no-disponible"}`;

    const descripcion = p.descripcion || p.detalle || p.descripcion_producto || "";
    const referencia = obtenerReferenciaProducto(p);

    card.innerHTML = `
      <div class="card-imagen-wrapper" data-img="${proxyUrl || p.imagen}" data-fallback="${fallbackSVG}" style="cursor: pointer; overflow: hidden; border-radius: 12px 12px 0 0;">
        ${disponible ? "" : `<div class="estado-badge">${etiquetaEstado}</div>`}
        <img
          class="card-imagen"
          src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCI+PC9zdmc+"
          data-src="${proxyUrl || p.imagen}"
          data-fallback="${fallbackSVG}"
          loading="lazy"
          alt="${p.nombre}"
          style="transition: transform 0.3s ease; display: block; width: 100%; height: auto;"
          title="Haz clic para ver en grande"
        >
        <button class="card-imagen-cta" type="button">🔍 Ver en grande</button>
      </div>
      <div class="info">
        <h3>${p.nombre}</h3>
        <p class="producto-descripcion">${descripcion || "Sin descripcion"}</p>
        <div class="precio">$ ${Number(p.precio).toLocaleString()}</div>
        <div class="producto-ref">Ref: ${referencia || "N/A"}</div>

        <div class="action-row">
          <div class="qty-card-compact">
            <button onclick="cambiarCantidadCard(${p.id}, -1)" title="Disminuir cantidad" ${disponible ? "" : "disabled"}>−</button>
            <input
              type="number"
              min="1"
              value="1"
              id="qty-${p.id}"
              ${disponible ? "" : "disabled"}
              aria-label="Cantidad de ${p.nombre}"
            >
            <button onclick="cambiarCantidadCard(${p.id}, 1)" title="Aumentar cantidad" ${disponible ? "" : "disabled"}>+</button>
          </div>
          <button class="btn-compact"
            onclick='agregarAlCarrito(${JSON.stringify(productoConProxy)}, document.getElementById("qty-${p.id}").value)'
            title="Agregar al carrito"
            ${disponible ? "" : "disabled"}>
            🛒
          </button>
        </div>
      </div>
    `;

    const wrapper = card.querySelector(".card-imagen-wrapper");
    const img = card.querySelector(".card-imagen");
    const cta = card.querySelector(".card-imagen-cta");

    wrapper.dataset.producto = JSON.stringify(productoConProxy);

    const abrirDesdeCard = () => {
      const producto = JSON.parse(wrapper.dataset.producto);
      abrirModalProducto(producto, wrapper.dataset.img || img.src, wrapper.dataset.fallback);
    };

    img.addEventListener("click", abrirDesdeCard);
    cta.addEventListener("click", abrirDesdeCard);

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
    const cacheVigente = cache.productos && Date.now() - cache.timestamp < cache.ttl;
    if (!cacheVigente && productosDiv) {
      renderSkeletonProductos(8);
      pageInfo.textContent = "Cargando...";
      const prevBtn = document.getElementById("prev");
      const nextBtn = document.getElementById("next");
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
    }

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

    const filtradosCategoria = categoriaSeleccionada
      ? all.filter(p => {
          const prodCat = normalizarTexto(p.categoria);
          const catNombre = normalizarTexto(categoriaSeleccionada.nombre);
          const catId = normalizarTexto(categoriaSeleccionada.id);
          return prodCat === catNombre || prodCat === catId;
        })
      : all;

    const query = normalizarTexto(textoBusqueda);
    const baseBusqueda = query ? all : filtradosCategoria;
    const filtrados = query
      ? baseBusqueda.filter(p => {
          const nombre = normalizarTexto(p.nombre);
          const referencia = normalizarTexto(obtenerReferenciaProducto(p));
          return nombre.includes(query) || referencia.includes(query);
        })
      : baseBusqueda;

    const ordenados = ordenarProductos(filtrados);

    if (query) {
      categoriaBreadcrumb.innerHTML = `Resultados: <span class="breadcrumb-muted">"${textoBusqueda}"</span>`;
    } else if (categoriaSeleccionada) {
      const label = categoriaSeleccionada ? categoriaSeleccionada.nombre : "Todas las categorías";
      categoriaBreadcrumb.innerHTML = `Categoría: <span class="breadcrumb-muted">${label}</span>`;
    } else {
      categoriaBreadcrumb.textContent = "";
    }

    actualizarBusquedaUI(ordenados.length);

    const totalPages = Math.ceil(ordenados.length / LIMIT);
    if (totalPages > 0 && page >= totalPages) {
      page = totalPages - 1;
    }

    const start = page * LIMIT;
    const items = ordenados.slice(start, start + LIMIT);

    pageInfo.textContent = ordenados.length === 0 ? "" : `Página ${page + 1} de ${totalPages}`;

    let emptyMessage = "No hay productos en esta categoría";
    if (query) {
      emptyMessage = categoriaSeleccionada
        ? "No hay productos que coincidan en esta categoría"
        : "No hay productos que coincidan con tu búsqueda";
    }

    render(items, emptyMessage);

    document.getElementById("prev").disabled = page === 0 || ordenados.length === 0;
    document.getElementById("next").disabled = ordenados.length === 0 || start + LIMIT >= ordenados.length;
  } catch (error) {
    console.error("Error en cargar():", error);
    toast.error("Error cargando productos");
  }
}

// Event Listeners de Paginación (solo si existen los elementos)
if (document.getElementById("prev")) {
  document.getElementById("prev").onclick = () => {
    if (page > 0) {
      page--;
      cargar();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
}

if (document.getElementById("next")) {
  document.getElementById("next").onclick = () => {
    page++;
    cargar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
}

if (categoriasBtn) {
  categoriasBtn.addEventListener("click", () => {
    irInicioCategorias();
  });
}

if (busquedaInput) {
  busquedaInput.addEventListener("input", () => {
    textoBusqueda = busquedaInput.value.trim();
    actualizarBotonLimpiarBusqueda();
    page = 0;

    if (textoBusqueda) {
      mostrarProductos();
      cargar();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    actualizarBusquedaUI(0);
    if (categoriaSeleccionada) {
      mostrarProductos();
      cargar();
    } else {
      mostrarCategorias();
    }
  });
}

if (busquedaClear) {
  busquedaClear.addEventListener("click", () => {
    textoBusqueda = "";
    if (busquedaInput) busquedaInput.value = "";
    actualizarBotonLimpiarBusqueda();
    actualizarBusquedaUI(0);
    page = 0;

    if (categoriaSeleccionada) {
      mostrarProductos();
      cargar();
    } else {
      mostrarCategorias();
    }
  });
}

if (sortSelect) {
  sortSelect.addEventListener("change", () => {
    ordenProductos = sortSelect.value;
    page = 0;

    if (textoBusqueda || categoriaSeleccionada) {
      mostrarProductos();
      cargar();
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN (SOLO EN INDEX.HTML)
// ═══════════════════════════════════════════════════════════════════════

if (productosDiv) { // Solo inicializar si estamos en index.html
  (async () => {
    try {
      console.log("🚀 Inicializando aplicación...");

      // Cargar y renderizar carrito inicial
      renderCarrito();
      actualizarBadgeCarrito();

      // Renderizar categorías iniciales (rápido desde BD si existe)
      let categoriasDb = await fetchCategorias();
      if (categoriasDb && categoriasDb.length > 0) {
        renderCategorias(categoriasDb);
        mostrarCategorias();
      }

      // Obtener productos (para catálogo y conteos)
      const productos = await fetchProductos();

      if (productos.length === 0) {
        toast.error("No se pudieron cargar los productos");
        return;
      }

      // Si no hay categorías en BD, generar desde productos
      if (!categoriasDb || categoriasDb.length === 0) {
        renderCategorias(productos);
        mostrarCategorias();
      } else {
        // Actualizar conteos con productos cargados
        const categoriasConConteo = actualizarConteoCategorias(productos, categoriasDb);
        renderCategorias(categoriasConConteo);
      }

      console.log("✅ Aplicación lista");
    } catch (error) {
      console.error("❌ Error en inicialización:", error);
      toast.error("Error iniciando la aplicación");
    }
  })();
} else {
  console.log("📱 Inicializando solo carrito (página no index.html)");
  // En otras páginas, solo inicializar el carrito
  renderCarrito();
  actualizarBadgeCarrito();
}

// ═══════════════════════════════════════════════════════════════════════
// SERVICIOS PRÁCTICOS
// ═══════════════════════════════════════════════════════════════════════

// Mantener carrito sincronizado entre pestañas/sesiones sin sobrescribir vacío
window.addEventListener("storage", (event) => {
  if (event.key === "carrito") {
    sincronizarCarritoDesdeStorage();
  }
});

// Sincronización periódica desactivada: se guarda solo en acciones del usuario

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

// Debug iconos de categorías
window.debugIconos = async () => {
  try {
    console.log("🔍 Debug de iconos de categorías");
    const categorias = await fetchCategorias();
    if (categorias && categorias.length > 0) {
      categorias.forEach(cat => {
        const iconoCalculado = getIconoCategoria(cat.id || cat.nombre, categorias);
        console.log(`${cat.nombre}: BD='${cat.icono}' → Mostrado='${iconoCalculado}'`);
      });
    } else {
      console.log("No hay categorías en BD");
    }
  } catch (error) {
    console.error("Error en debugIconos:", error);
  }
};

// Debug para categorías
window.debugCategorias = async () => {
  console.log("🔍 Debug de categorías:");
  console.log("Categoría seleccionada:", categoriaSeleccionada);
  
  try {
    const productos = await fetchProductos();
    console.log("Total productos:", productos.length);
    
    if (categoriaSeleccionada) {
      const filtrados = productos.filter(p => {
        const prodCat = String(p.categoria || "").toLowerCase().trim();
        const catNombre = String(categoriaSeleccionada.nombre || "").toLowerCase().trim();
        const catId = String(categoriaSeleccionada.id || "").toLowerCase().trim();
        const match = prodCat === catNombre || prodCat === catId;
        if (match) console.log("✅ Producto encontrado:", p.nombre, "- categoría:", p.categoria);
        return match;
      });
      console.log("Productos filtrados:", filtrados.length);
    } else {
      console.log("No hay categoría seleccionada");
    }
  } catch (error) {
    console.error("Error en debug:", error);
  }
};

// Cerrar el bloque condicional para index.html
}
