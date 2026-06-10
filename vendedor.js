/* ═══════════════════════════════════════════════════════════════════════
   VENDEDOR.JS – Capa de precios especiales sobre el catálogo público
   Se carga DESPUÉS de app.js. No reemplaza el catálogo, solo lo enriquece.
   ═══════════════════════════════════════════════════════════════════════ */

const V_API_URL = "https://script.google.com/macros/s/AKfycbyiWFmktbcbD8qjosEULA13rpJPr9AkuAK7ZYkB8PzoMWMQcSFUFSqrg7pJkELoXxSy/exec";
const V_API_PROXY = "https://pedido-proxy.pedidosnia-cali.workers.dev";
const V_API_KEY = "TIENDA_API_2026";
const V_SESION_KEY = "vendedor_sesion_v1";
const V_CARRITO_KEY = "vendedor_carrito_v1";

/* ─── Estado del vendedor ────────────────────────────────────────────── */
let vSesion = null;   // { nombre, usuario, nivel_precio, token }
let vNivelDefault = 1;      // Precio por defecto al mostrar nuevos productos
let vPreciosPorProducto = {};     // { "productId": nivel }
let vCarrito = [];

/* ─── Toast vendedor (independiente del sistema público) ─────────────── */
const vToast = {
  _show(msg, tipo, dur = 3500) {
    const c = document.getElementById("vToastContainer");
    if (!c) return;
    const t = document.createElement("div");
    t.className = `v-toast v-toast--${tipo}`;
    const icons = { success: "✓", error: "✕", warning: "⚠", info: "ℹ" };
    t.innerHTML = `<span style="font-size:16px">${icons[tipo] || "ℹ"}</span><span>${msg}</span>`;
    c.appendChild(t);
    setTimeout(() => {
      t.classList.add("v-toast--out");
      setTimeout(() => t.remove(), 350);
    }, dur);
  },
  ok(m) { this._show(m, "success"); },
  error(m) { this._show(m, "error", 5000); },
  warn(m) { this._show(m, "warning"); },
  info(m) { this._show(m, "info"); }
};

/* ─── Sesión ─────────────────────────────────────────────────────────── */
function vGuardarSesion(datos) {
  vSesion = datos;
  vNivelDefault = datos.nivel_precio;
  sessionStorage.setItem(V_SESION_KEY, JSON.stringify(datos));
}

function vCargarSesion() {
  try {
    const raw = sessionStorage.getItem(V_SESION_KEY);
    if (!raw) return false;
    vSesion = JSON.parse(raw);
    vNivelDefault = vSesion.nivel_precio;
    vCarrito = JSON.parse(sessionStorage.getItem(V_CARRITO_KEY) || "[]");
    return true;
  } catch { return false; }
}

function vGuardarCarrito() {
  sessionStorage.setItem(V_CARRITO_KEY, JSON.stringify(vCarrito));
}

function cerrarSesionVendedor() {
  vSesion = null;
  vCarrito = [];
  vPreciosPorProducto = {};
  sessionStorage.removeItem(V_SESION_KEY);
  sessionStorage.removeItem(V_CARRITO_KEY);
  vDesinstalarHookCarrito(); // Restaurar agregarAlCarrito original
  vOcultarBarraVendedor();
  vRetirarChips();
  mostrarLoginVendedor();
}

/* ─── Login ──────────────────────────────────────────────────────────── */
async function vLogin(e) {
  e.preventDefault();
  const usuario = document.getElementById("vUsuario").value.trim();
  const clave = document.getElementById("vClave").value.trim();
  const btn = document.getElementById("vBtnLogin");
  if (!usuario || !clave) { vToast.warn("Completa usuario y clave"); return; }

  btn.disabled = true;
  btn.textContent = "Verificando…";

  try {
    const url = `${V_API_URL}?action=loginVendedor&key=${V_API_KEY}&usuario=${encodeURIComponent(usuario)}&clave=${encodeURIComponent(clave)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.ok) {
      vToast.error(data.error || "Credenciales inválidas");
      btn.disabled = false;
      btn.textContent = "Ingresar al portal";
      return;
    }

    vGuardarSesion(data);
    vToast.ok(`¡Bienvenido, ${data.nombre}!`);
    ocultarLoginVendedor();
    vActivarModoVendedor();
  } catch {
    vToast.error("Error de conexión. Intenta de nuevo.");
    btn.disabled = false;
    btn.textContent = "Ingresar al portal";
  }
}

function mostrarLoginVendedor() {
  const el = document.getElementById("v-login-overlay");
  if (el) el.style.display = "flex";
  const btn = document.getElementById("vBtnLogin");
  if (btn) { btn.disabled = false; btn.textContent = "Ingresar al portal"; }
  const claveInput = document.getElementById("vClave");
  const mostrarClave = document.getElementById("vMostrarClave");
  if (claveInput) claveInput.type = "password";
  if (mostrarClave) mostrarClave.checked = false;
}

function ocultarLoginVendedor() {
  const el = document.getElementById("v-login-overlay");
  if (el) el.style.display = "none";
}

function vConfigurarToggleClave() {
  const claveInput = document.getElementById("vClave");
  const mostrarClave = document.getElementById("vMostrarClave");
  if (!claveInput || !mostrarClave) return;

  mostrarClave.addEventListener("change", () => {
    claveInput.type = mostrarClave.checked ? "text" : "password";
  });
}

/* ─── Activar modo vendedor ──────────────────────────────────────────── */
function vActivarModoVendedor() {
  if (!vSesion) return;
  vMostrarBarraVendedor();
  vInstalarHookCarrito(); // Sobrescribir agregarAlCarrito de app.js
  vActualizarBadgeCarrito(); // Restaurar badge con items del carrito persistido
  // app.js puede tardar en renderizar; esperamos un ciclo
  setTimeout(vInyectarChipsEnGrid, 200);
}

function vMostrarBarraVendedor() {
  const bar = document.getElementById("v-vendor-bar");
  if (!bar) return;
  bar.style.display = "flex";

  const nombreEl = document.getElementById("vNombreVendedor");
  if (nombreEl) nombreEl.textContent = vSesion.nombre;

  const badgeEl = document.getElementById("vNivelBadge");
  if (badgeEl) {
    const labels = { 1: "Precio Público", 2: "Distribuidor", 3: "Especial" };
    badgeEl.textContent = `Nivel ${vSesion.nivel_precio}: ${labels[vSesion.nivel_precio] || ""}`;
    badgeEl.className = `v-vendor-nivel v-nivel--${vSesion.nivel_precio}`;
  }

  vRenderSelectorNivel();
}

function vOcultarBarraVendedor() {
  const bar = document.getElementById("v-vendor-bar");
  if (bar) bar.style.display = "none";
}

function vRenderSelectorNivel() {
  if (!vSesion) return;
  const cont = document.getElementById("vSelectorNivel");
  if (!cont) return;
  cont.innerHTML = "";
  for (let i = 1; i <= vSesion.nivel_precio; i++) {
    const btn = document.createElement("button");
    btn.className = `v-btn-nivel${i === vNivelDefault ? " v-btn-nivel--activo" : ""}`;
    btn.dataset.nivel = i;
    btn.textContent = `P${i}`;
    btn.title = `Precio ${i} por defecto`;
    btn.onclick = () => vCambiarNivelDefault(i);
    cont.appendChild(btn);
  }
}

function vCambiarNivelDefault(nivel) {
  if (!vSesion || nivel > vSesion.nivel_precio) return;
  vNivelDefault = nivel;
  vRenderSelectorNivel();
  vToast.info(`Precio por defecto: P${nivel}`);
}

/* ─── Chips de precio ────────────────────────────────────────────────── */

/**
 * Recorre todas las cards del grid de app.js e inyecta los chips de precio.
 * app.js usa:
 *   - div.card[data-product-id]
 *   - var _productosCache = { [id]: { ...producto, precio, precio2, precio3 } }
 *   - div.precio para mostrar el precio público
 *   - button.btn-compact para agregar al carrito
 */
function vInyectarChipsEnGrid() {
  if (!vSesion) return;
  // Solo inyectar chips cuando el vendedor tiene acceso a más de un nivel de precio
  if (vSesion.nivel_precio < 2) return;

  const cards = document.querySelectorAll(".card[data-product-id]");
  cards.forEach(card => {
    // Evitar duplicados
    if (card.dataset.vChips) return;

    const idStr = String(card.dataset.productId || "");
    if (!idStr) return;

    // Leer datos desde la cache de app.js (_productosCache es un obj global con claves numéricas)
    const prod = (typeof _productosCache !== "undefined")
      ? (_productosCache[Number(idStr)] || _productosCache[idStr] || null)
      : null;

    if (!prod) return;

    vAgregarChipsACard(card, prod, idStr);
  });
}

function vAgregarChipsACard(card, prod, idStr) {
  const nivelActual = vPreciosPorProducto[idStr] !== undefined
    ? vPreciosPorProducto[idStr]
    : vNivelDefault;

  const precio1 = Number(prod.precio || 0);
  const precio2 = Number(prod.precio2 || 0);
  const precio3 = Number(prod.precio3 || 0);

  const wrap = document.createElement("div");
  wrap.className = "v-precio-chips";

  // P1 siempre visible si hay precio público
  if (precio1 > 0) {
    wrap.appendChild(vCrearChip(idStr, 1, precio1, nivelActual));
  }
  // P2: solo si el vendedor tiene nivel >= 2
  if (vSesion.nivel_precio >= 2) {
    if (precio2 > 0) {
      wrap.appendChild(vCrearChip(idStr, 2, precio2, nivelActual));
    } else {
      // Chip deshabilitado para indicar que no hay precio2 configurado
      const ph = document.createElement("span");
      ph.className = "v-chip v-chip--2";
      ph.style.opacity = "0.35";
      ph.style.cursor = "default";
      ph.innerHTML = `<b>P2</b>&nbsp;—`;
      ph.title = "Precio 2 no configurado";
      wrap.appendChild(ph);
    }
  }
  // P3: solo si el vendedor tiene nivel >= 3
  if (vSesion.nivel_precio >= 3) {
    if (precio3 > 0) {
      wrap.appendChild(vCrearChip(idStr, 3, precio3, nivelActual));
    } else {
      const ph = document.createElement("span");
      ph.className = "v-chip v-chip--3";
      ph.style.opacity = "0.35";
      ph.style.cursor = "default";
      ph.innerHTML = `<b>P3</b>&nbsp;—`;
      ph.title = "Precio 3 no configurado";
      wrap.appendChild(ph);
    }
  }

  // Solo insertar si hay chips
  if (wrap.children.length === 0) return;

  // Insertar antes del div.precio (precio público de la card)
  const precioPublicoEl = card.querySelector(".precio");
  if (precioPublicoEl) {
    precioPublicoEl.parentNode.insertBefore(wrap, precioPublicoEl);
  } else {
    const info = card.querySelector(".info");
    if (info) info.appendChild(wrap);
    else card.appendChild(wrap);
  }

  // ── Reemplazar el onclick del 🛒 original ─────────────────────────────
  const btnCompact = card.querySelector(".btn-compact");
  if (btnCompact && !btnCompact._vHooked) {
    btnCompact._vHooked = true;
    const originalOnclick = btnCompact.onclick;
    btnCompact.onclick = function (e) {
      if (!vSesion) {
        if (originalOnclick) originalOnclick.call(this, e);
        return;
      }
      e.stopPropagation();
      const prodFresh = (typeof _productosCache !== "undefined")
        ? (_productosCache[Number(idStr)] || _productosCache[idStr] || null)
        : null;
      if (!prodFresh) return;
      const qtyInput = card.querySelector(`[id^="qty-"]`);
      const cantidad = qtyInput ? Math.max(1, Number(qtyInput.value) || 1) : 1;
      vAgregarAlCarritoVendedor(idStr, prodFresh, cantidad);
    };
  }

  // Marcar card como procesada
  card.dataset.vChips = "1";
}


function vCrearChip(idStr, nivel, precio, nivelActual) {
  const labels = { 1: "Público", 2: "Distrib.", 3: "Especial" };
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `v-chip v-chip--${nivel}${nivel === nivelActual ? " v-chip--activo" : ""}`;
  btn.dataset.nivel = nivel;
  btn.dataset.prod = idStr;
  btn.title = `P${nivel} ${labels[nivel]}`;
  btn.innerHTML = `<b>P${nivel}</b>&nbsp;$${precio.toLocaleString("es-CO")}`;
  btn.addEventListener("click", e => {
    e.stopPropagation();
    e.preventDefault();
    vSeleccionarPrecioProducto(idStr, nivel);
  });
  return btn;
}

function vSeleccionarPrecioProducto(idStr, nivel) {
  if (!vSesion || nivel > vSesion.nivel_precio) return;
  vPreciosPorProducto[idStr] = nivel;

  // Resaltar chip activo
  const card = document.querySelector(`.card[data-product-id="${idStr}"]`);
  if (card) {
    card.querySelectorAll(".v-chip").forEach(c => {
      c.classList.toggle("v-chip--activo", Number(c.dataset.nivel) === nivel);
    });
  }
}

function vRetirarChips() {
  // Restaurar onclick original de cada botón 🛒 antes de quitar los chips
  document.querySelectorAll(".card[data-product-id]").forEach(card => {
    const btn = card.querySelector(".btn-compact");
    if (btn && btn._onclickOriginal !== undefined) {
      btn.onclick = btn._onclickOriginal;
      delete btn._onclickOriginal;
    }
    delete card.dataset.vChips;
  });
  document.querySelectorAll(".v-precio-chips").forEach(el => el.remove());
}

/* ─── Obtener precio según nivel ─────────────────────────────────────── */
function vObtenerPrecio(prod, nivel) {
  nivel = Number(nivel) || 1;
  const p3 = Number(prod.precio3 || 0);
  const p2 = Number(prod.precio2 || 0);
  const p1 = Number(prod.precio || 0);
  if (nivel === 3 && p3 > 0) return p3;
  if (nivel === 2 && p2 > 0) return p2;
  return p1;
}

function vEtiquetaNivel(nivel) {
  return nivel === 1 ? "Precio Público" : nivel === 2 ? "Precio Distribuidor" : "Precio Especial";
}

/* ─── Interceptar carrito de app.js ─────────────────────────────────────
 *
 * app.js usa onclick inline: agregarAlCarrito(_productosCache[id], qty)
 * La única forma fiable de interceptar eso es SOBRESCRIBIR la función global
 * agregarAlCarrito cuando hay sesión de vendedor activa.
 * La función original de app.js se guarda en _appAgregarAlCarrito.
 * ─────────────────────────────────────────────────────────────────────── */
let _appAgregarAlCarrito = null;

function vInstalarHookCarrito() {
  // Guardar referencia a la función original de app.js
  if (typeof window.agregarAlCarrito === "function") {
    _appAgregarAlCarrito = window.agregarAlCarrito;
  }

  // Sobrescribir con nuestra versión vendedor
  window.agregarAlCarrito = function (producto, cantidad) {
    if (!vSesion) {
      // Sin sesión vendedor: comportamiento normal
      if (_appAgregarAlCarrito) _appAgregarAlCarrito(producto, cantidad);
      return;
    }

    // Con sesión vendedor: usar carrito de vendedor
    if (!producto) return;
    const idStr = String(producto.id || "");
    const cantNum = Math.max(1, Number(cantidad) || 1);

    // Enriquecer el producto con precio2/precio3 desde _productosCache si no los tiene
    const prodEnriquecido = {
      ...producto,
      precio2: producto.precio2 || "",
      precio3: producto.precio3 || ""
    };

    vAgregarAlCarritoVendedor(idStr, prodEnriquecido, cantNum);
  };
}

function vDesinstalarHookCarrito() {
  if (_appAgregarAlCarrito) {
    window.agregarAlCarrito = _appAgregarAlCarrito;
    _appAgregarAlCarrito = null;
  }
}

/* ─── Carrito vendedor ───────────────────────────────────────────────── */
function vAgregarAlCarritoVendedor(idStr, prod, cantidad) {
  const nivelProducto = vPreciosPorProducto[idStr] !== undefined
    ? vPreciosPorProducto[idStr]
    : vNivelDefault;

  const precio = vObtenerPrecio(prod, nivelProducto);
  const nombre = prod.nombre || "Producto";
  const existente = vCarrito.find(c => c.id === idStr && c.nivel_precio === nivelProducto);

  if (existente) {
    existente.cantidad += cantidad;
    vToast.info(`Cantidad actualizada: ${nombre}`);
  } else {
    vCarrito.push({
      id: idStr, nombre,
      referencia: prod.referencia || prod.ref || "",
      precio, nivel_precio: nivelProducto,
      cantidad, categoria: prod.categoria || "",
      imagen: prod.imagen || ""
    });
    vToast.ok(`✓ ${nombre} — ${vEtiquetaNivel(nivelProducto)} ($${precio.toLocaleString("es-CO")})`);
  }

  vGuardarCarrito();
  vActualizarBadgeCarrito();
}

function vActualizarBadgeCarrito() {
  const badge = document.getElementById("vCartBadge");
  const total = vCarrito.reduce((s, i) => s + i.cantidad, 0);
  if (badge) badge.textContent = total;
}

/* ─── Panel carrito vendedor (overlay) ───────────────────────────────── */
function abrirCarritoVendedor() {
  if (!vSesion) return;
  const overlay = document.getElementById("v-carrito-overlay");
  if (overlay) overlay.style.display = "block";
  vRenderCarritoVendedor();
}

function cerrarCarritoVendedor() {
  const overlay = document.getElementById("v-carrito-overlay");
  if (overlay) overlay.style.display = "none";
}

function vRenderCarritoVendedor() {
  const cont = document.getElementById("vCarritoItems");
  const grid = document.getElementById("vCheckoutGrid");
  if (!cont) return;

  if (!vCarrito.length) {
    cont.innerHTML = `<div class="v-carrito-empty">🛒 Tu carrito de venta está vacío</div>`;
    if (grid) grid.style.display = "none";
    return;
  }

  if (grid) grid.style.display = "grid";

  cont.innerHTML = vCarrito.map((item, idx) => `
    <div class="v-carrito-row">
      <div class="v-carrito-row__info">
        <p class="v-carrito-row__nombre">${item.nombre}</p>
        <p class="v-carrito-row__meta">${item.referencia ? `Ref: ${item.referencia} · ` : ""}${vEtiquetaNivel(item.nivel_precio)}</p>
        <span class="v-carrito-row__precio">$${item.precio.toLocaleString("es-CO")} c/u</span>
      </div>
      <div class="v-carrito-row__qty">
        <button onclick="vCambiarQtyCarrito(${idx}, -1)">−</button>
        <span>${item.cantidad}</span>
        <button onclick="vCambiarQtyCarrito(${idx}, 1)">+</button>
      </div>
      <div class="v-carrito-row__subtotal">$${(item.precio * item.cantidad).toLocaleString("es-CO")}</div>
      <button class="v-btn-del" onclick="vEliminarDelCarrito(${idx})" title="Eliminar">✕</button>
    </div>
  `).join("");

  vActualizarResumenVendedor();
}

function vCambiarQtyCarrito(idx, delta) {
  if (!vCarrito[idx]) return;
  vCarrito[idx].cantidad += delta;
  if (vCarrito[idx].cantidad <= 0) vCarrito.splice(idx, 1);
  vGuardarCarrito();
  vRenderCarritoVendedor();
  vActualizarBadgeCarrito();
}

function vEliminarDelCarrito(idx) {
  const nombre = vCarrito[idx]?.nombre || "";
  vCarrito.splice(idx, 1);
  vGuardarCarrito();
  vRenderCarritoVendedor();
  vActualizarBadgeCarrito();
  vToast.info(`${nombre} eliminado`);
}

function vaciarCarritoVendedor() {
  if (!vCarrito.length) return;
  if (!confirm("¿Vaciar el carrito de venta?")) return;
  vCarrito = [];
  vGuardarCarrito();
  vRenderCarritoVendedor();
  vActualizarBadgeCarrito();
}

function vActualizarResumenVendedor() {
  const subtotal = vCarrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const items = vCarrito.reduce((s, i) => s + i.cantidad, 0);
  const elSub = document.getElementById("vResumenSubtotal");
  const elTotal = document.getElementById("vResumenTotal");
  const elItems = document.getElementById("vResumenItems");
  if (elSub) elSub.textContent = `$${subtotal.toLocaleString("es-CO")}`;
  if (elTotal) elTotal.textContent = `$${subtotal.toLocaleString("es-CO")}`;
  if (elItems) elItems.textContent = items;
}

/* ─── Checkout vendedor ──────────────────────────────────────────────── */
async function vFinalizarPedido(e) {
  e.preventDefault();
  if (!vCarrito.length) { vToast.warn("El carrito está vacío"); return; }

  const nombreCliente = document.getElementById("vNombreCliente").value.trim();
  const ciudadCliente = document.getElementById("vCiudadCliente").value.trim();
  const telCliente = document.getElementById("vTelCliente").value.trim();
  const notasCliente = document.getElementById("vNotasCliente").value.trim();

  if (!nombreCliente || !ciudadCliente) {
    vToast.warn("Nombre y ciudad del cliente son requeridos"); return;
  }

  const btn = document.getElementById("vBtnFinalizar");
  const txtOrig = btn.textContent;
  btn.disabled = true;
  btn.textContent = "⏳ Procesando…";

  const total = vCarrito.reduce((s, i) => s + i.precio * i.cantidad, 0);

  const payload = {
    key: V_API_KEY,
    vendedor_token: vSesion.token,
    vendedor: vSesion.usuario,
    nivel_precio: vNivelDefault,
    cliente: { nombre: nombreCliente, ciudad: ciudadCliente, telefono: telCliente, notas: notasCliente },
    items: vCarrito.map(i => ({
      id: i.id, nombre: i.nombre, referencia: i.referencia,
      precio: i.precio, nivel_precio: i.nivel_precio,
      cantidad: i.cantidad, categoria: i.categoria
    })),
    total
  };

  try {
    const res = await fetch(V_API_PROXY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch { data = { ok: true, pedido_id: "registrado" }; }
    if (!(data.ok || data.success || res.ok)) throw new Error(data.error || "Error al crear pedido");

    const pedidoId = data.pedido_id || "confirmado";
    vToast.ok(`✓ Pedido #${pedidoId} creado`);

    vCarrito = [];
    vGuardarCarrito();
    vRenderCarritoVendedor();
    vActualizarBadgeCarrito();
    document.getElementById("vFormCliente").reset();
    vMostrarConfirmacionVendedor(pedidoId, total);
  } catch (err) {
    vToast.error("Error: " + (err.message || err));
  } finally {
    btn.disabled = false;
    btn.textContent = txtOrig;
  }
}

function vMostrarConfirmacionVendedor(pedidoId, total) {
  const modal = document.getElementById("v-modal-confirm");
  const msg = document.getElementById("vConfirmMsg");
  if (msg) msg.innerHTML = `<strong>Pedido #${pedidoId}</strong> registrado.<br>Total: <strong>$${Number(total).toLocaleString("es-CO")}</strong>`;
  if (modal) modal.style.display = "flex";
  cerrarCarritoVendedor();
}

function cerrarConfirmacionVendedor() {
  const modal = document.getElementById("v-modal-confirm");
  if (modal) modal.style.display = "none";
}

/* ─── MutationObserver — detecta re-renders del catálogo de app.js ───── */
function vIniciarObservador() {
  const grid = document.getElementById("productos");
  if (!grid) return;

  const observer = new MutationObserver(() => {
    if (vSesion) setTimeout(vInyectarChipsEnGrid, 100);
  });

  // subtree:true para capturar renders dentro de los hijos también
  observer.observe(grid, { childList: true, subtree: true });
}

/* ─── Init ───────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  // Login form
  const loginForm = document.getElementById("vFormLogin");
  if (loginForm) loginForm.addEventListener("submit", vLogin);
  vConfigurarToggleClave();

  // Formulario pedido
  const formCliente = document.getElementById("vFormCliente");
  if (formCliente) formCliente.addEventListener("submit", vFinalizarPedido);

  // Cerrar carrito overlay al clic fuera del panel
  const carritoOverlay = document.getElementById("v-carrito-overlay");
  if (carritoOverlay) {
    carritoOverlay.addEventListener("click", function (e) {
      if (e.target === this) cerrarCarritoVendedor();
    });
  }

  // Cerrar modal confirmación al clic fuera
  const modalConfirm = document.getElementById("v-modal-confirm");
  if (modalConfirm) {
    modalConfirm.addEventListener("click", function (e) {
      if (e.target === this) cerrarConfirmacionVendedor();
    });
  }

  // Observar re-renders del catálogo de app.js
  vIniciarObservador();

  // Comprobar sesión guardada
  if (vCargarSesion()) {
    ocultarLoginVendedor();
    // Dar tiempo a que app.js termine de cargar el catálogo (~800ms para cold start GAS)
    setTimeout(vActivarModoVendedor, 800);
  } else {
    mostrarLoginVendedor();
  }
});
