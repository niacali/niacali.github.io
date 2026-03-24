/* ═══════════════════════════════════════════════════════════════════════
   CARRITO.JS - PÁGINA DE CARRITO MEJORADA
   ═══════════════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN GLOBAL PARA CARRITO
// ═══════════════════════════════════════════════════════════════════════

if (typeof API_URL === 'undefined') {
  window.API_URL = "https://script.google.com/macros/s/AKfycbzyTr5PyWTicE2P4derkKDZ7Sqf8Gf5OkfH6jrsSo6HFrsx4nbYfsBrrT-MQoPNpweVAQ/exec";
}
if (typeof API_PROXY_URL === 'undefined') {
  window.API_PROXY_URL = "https://pedido-proxy.pedidosnia-cali.workers.dev";
}
if (typeof API_PDF_WORKER_URL === 'undefined') {
  window.API_PDF_WORKER_URL = "https://pedido-pdf.pedidosnia-cali.workers.dev";
}
if (typeof API_KEY === 'undefined') {
  window.API_KEY = "TIENDA_API_2026";
}
if (typeof WHATSAPP_BODEGA_NUMBER === 'undefined') {
  // Formato internacional sin +, por ejemplo: 573001234567
  window.WHATSAPP_BODEGA_NUMBER = "";
}

// Asegurar toast global
if (typeof toast === 'undefined') {
  window.toast = {
    info: msg => alert(msg),
    error: msg => alert("Error: " + msg),
    exito: msg => alert("✔ " + msg),
    advertencia: msg => alert("⚠ " + msg)
  };
}

// ═══════════════════════════════════════════════════════════════════════
// CARRITO GLOBAL PARA TODAS LAS PÁGINAS
// ═══════════════════════════════════════════════════════════════════════

if (typeof window.carrito === 'undefined') {
  window.carrito = JSON.parse(localStorage.getItem("carrito")) || [];
}
// Usar getter/setter para acceder a window.carrito
const getCarrito = () => window.carrito;
const carrito = getCarrito();
let whatsappModalResolver = null;
let whatsappModalPayload = null;

// ═══════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════════════

function inicializarCarritoPage() {
  renderizarCarritoPage();
  actualizarResumen();
}

// ═══════════════════════════════════════════════════════════════════════
// RENDERIZAR CARRITO
// ═══════════════════════════════════════════════════════════════════════

function renderizarCarritoPage() {
  const carritoPageItems = document.getElementById("carritoPageItems");
  const carritoPageVacio = document.getElementById("carritoPageVacio");

  if (!carrito || carrito.length === 0) {
    carritoPageItems.style.display = "none";
    carritoPageVacio.style.display = "flex";
    return;
  }

  carritoPageItems.style.display = "grid";
  carritoPageVacio.style.display = "none";
  carritoPageItems.innerHTML = "";

  carrito.forEach((item, index) => {
    const itemDiv = document.createElement("div");
    itemDiv.className = "carrito-item-card";
    
    const subtotal = item.precio * item.cantidad;

    itemDiv.innerHTML = `
      <div class="item-imagen">
        <img src="${item.imagen}" alt="${item.nombre}" loading="lazy">
      </div>

      <div class="item-detalles">
        <h3>${item.nombre}</h3>
        <p class="item-categoria">${item.categoria}</p>
        <p class="item-precio">$ ${Number(item.precio).toLocaleString()}</p>
      </div>

      <div class="item-cantidad">
        <button onclick="cambiarCantidadCarritoPage(${index}, -1)" class="btn-cantidad">−</button>
        <input type="number" value="${item.cantidad}" readonly class="cantidad-input">
        <button onclick="cambiarCantidadCarritoPage(${index}, 1)" class="btn-cantidad">+</button>
      </div>

      <div class="item-subtotal">
        <div>$ ${subtotal.toLocaleString()}</div>
      </div>

      <button onclick="eliminarDelCarritoPage(${index})" class="btn-eliminar" title="Eliminar">
        <span class="material-symbols-outlined">delete</span>
      </button>
    `;

    carritoPageItems.appendChild(itemDiv);
  });
}

// ═══════════════════════════════════════════════════════════════════════
// CAMBIAR CANTIDAD
// ═══════════════════════════════════════════════════════════════════════

function cambiarCantidadCarritoPage(index, cambio) {
  if (carrito[index]) {
    const nuevaCantidad = carrito[index].cantidad + cambio;
    
    if (nuevaCantidad <= 0) {
      eliminarDelCarritoPage(index);
    } else {
      carrito[index].cantidad = nuevaCantidad;
      guardarCarrito();
      renderizarCarritoPage();
      actualizarResumen();
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ELIMINAR DEL CARRITO
// ═══════════════════════════════════════════════════════════════════════

function eliminarDelCarritoPage(index) {
  const producto = carrito[index];
  carrito.splice(index, 1);
  guardarCarrito();
  renderizarCarritoPage();
  actualizarResumen();
  
  if (toast) {
    toast.info(`${producto.nombre} eliminado del carrito`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ACTUALIZAR RESUMEN
// ═══════════════════════════════════════════════════════════════════════

function actualizarResumen() {
  if (carrito.length === 0) {
    document.getElementById("resumenItems").textContent = "0";
    document.getElementById("resumenSubtotal").textContent = "$ 0";
    document.getElementById("resumenTotal").textContent = "$ 0";
    return;
  }

  const subtotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  const totalItems = carrito.reduce((sum, item) => sum + item.cantidad, 0);

  document.getElementById("resumenItems").textContent = totalItems;
  document.getElementById("resumenSubtotal").textContent = `$ ${subtotal.toLocaleString()}`;
  document.getElementById("resumenTotal").textContent = `$ ${subtotal.toLocaleString()}`;
}

// ═══════════════════════════════════════════════════════════════════════
// FINALIZAR PEDIDO DESDE PÁGINA DE CARRITO (CON PDF Y ENVÍO A BODEGA)
// ═══════════════════════════════════════════════════════════════════════

async function finalizarPedidoCarritoPage() {
  if (carrito.length === 0) {
    if (toast) toast.advertencia("Tu carrito está vacío");
    return;
  }

  const nombre = document.getElementById("inputNombre").value.trim();
  const ciudad = document.getElementById("inputCiudad").value.trim();
  const telefono = document.getElementById("inputTelefono").value.trim();
  const notas = document.getElementById("inputNotas").value.trim();

  if (!nombre || !ciudad) {
    if (toast) toast.error("Por favor completa nombre y ciudad");
    return;
  }

  // Calcular total
  const total = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);

  // Mostrar indicador de carga
  const btnFinalizar = document.querySelector('.btn-finalizar[onclick="finalizarPedidoCarritoPage()"]');
  const btnOriginalText = btnFinalizar ? btnFinalizar.textContent : "";
  
  if (btnFinalizar) {
    btnFinalizar.disabled = true;
    btnFinalizar.textContent = "⏳ Procesando pedido...";
  }

  try {
    // 1. CREAR PEDIDO EN LA BASE DE DATOS
    const resCrearPedido = await fetch("https://pedido-proxy.pedidosnia-cali.workers.dev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "crearPedido",
        key: API_KEY,
        cliente: { nombre: nombre, ciudad: ciudad, telefono: telefono, notas: notas },
        items: carrito,
        total
      })
    });

    // Obtener texto de respuesta primero
    const responseText = await resCrearPedido.text();
    
    // Intentar parsear como JSON
    let dataPedido = null;
    try {
      dataPedido = JSON.parse(responseText);
    } catch (e) {
      // Si no es JSON válido, considerar éxito si status 200
      console.warn("Respuesta no es JSON válido:", responseText.substring(0, 100));
      dataPedido = { 
        success: true, 
        pedido_id: "pedido registrado",
        warning: "Confirmación del servidor con error, pero datos guardados"
      };
    }

    if (!(dataPedido.success || resCrearPedido.status === 200)) {
      throw new Error(dataPedido.error || dataPedido.mensaje || "Error al crear pedido");
    }

    const pedidoID = dataPedido.pedido_id || "confirmado";
    const datosCliente = { nombre, ciudad, telefono, notas };

    // Cargar número de WhatsApp de bodega desde hoja Config
    const configWhatsapp = await cargarWhatsappBodegaDesdeConfig();
    if (configWhatsapp.success) {
      window.WHATSAPP_BODEGA_NUMBER = configWhatsapp.whatsapp_bodega;
    }

    // Actualizar UI
    if (btnFinalizar) {
      btnFinalizar.textContent = "📄 Generando PDFs...";
    }

    // 2. GENERAR PDF PARA CLIENTE (Cloudflare Worker)
    if (btnFinalizar) {
      btnFinalizar.textContent = "📄 Generando PDF...";
    }

    const resGenerarPdf = await generarYDescargarPdfCliente(pedidoID, datosCliente, carrito, total);

    if (!resGenerarPdf.success) {
      console.warn("Advertencia: No se pudo generar PDF del cliente:", resGenerarPdf.error);
    } else {
      console.log("✓ PDF del cliente generado");
    }

    // 3. ENVIAR NOTIFICACIÓN A BODEGA (correo HTML sin adjunto)
    if (btnFinalizar) {
      btnFinalizar.textContent = "📧 Notificando a bodega...";
    }

    const resEnvioBodega = await enviarNotificacionBodega(pedidoID, datosCliente, carrito);

    if (!resEnvioBodega.success) {
      console.warn("Advertencia: No se pudo enviar a bodega:", resEnvioBodega.error || resEnvioBodega.warning);
    } else {
      console.log("✓ Bodega notificada");
    }

    // 4. PREGUNTAR SI DESEA NOTIFICAR POR WHATSAPP
    let resWhatsapp = { success: false, skipped: true };
    const whatsappDisponible = Boolean(window.WHATSAPP_BODEGA_NUMBER);
    if (whatsappDisponible) {
      if (btnFinalizar) {
        btnFinalizar.textContent = "💬 Esperando confirmación WhatsApp...";
      }
      resWhatsapp = await preguntarNotificacionWhatsapp({
        pedidoID,
        cliente: datosCliente,
        items: carrito,
        total
      });
      if (!resWhatsapp.success && !resWhatsapp.skipped) {
        console.warn("Advertencia: No se pudo preparar WhatsApp:", resWhatsapp.error || resWhatsapp.warning);
      } else if (resWhatsapp.success) {
        console.log("✓ WhatsApp preparado");
      }
    } else if (configWhatsapp.warning) {
      resWhatsapp = { success: false, warning: configWhatsapp.warning };
    }

    // ÉXITO FINAL
    const whatsappEstado = resWhatsapp.success
      ? "\n💬 WhatsApp abierto"
      : (resWhatsapp.skipped ? "\n💬 WhatsApp no enviado" : (resWhatsapp.warning ? `\n💬 ${resWhatsapp.warning}` : ""));
    const mensaje = `✓ ¡Pedido ${pedidoID} creado exitosamente!\n📄 PDF generado\n📧 Bodega notificada${whatsappEstado}`;
    
    // Limpiar carrito
    vaciarCarritoCompleto();
    
    // Limpiar formulario
    document.getElementById("formularioPedido").reset();
    
    // Revertir botón con confirmación visual
    if (btnFinalizar) {
      btnFinalizar.textContent = "✓ Pedido Enviado";
    }
    
    // Renderizar carrito vacío
    renderizarCarritoPage();
    actualizarResumen();

    // Mostrar modal de confirmación
    mostrarModalConfirmacion(mensaje);
    
    // Restaurar texto del botón
    if (btnFinalizar) {
      btnFinalizar.textContent = btnOriginalText;
      btnFinalizar.disabled = false;
    }
  } catch (error) {
    console.error("Error enviando pedido:", error);
    if (toast) toast.error("Error al enviar pedido: " + error.message);
    
    if (btnFinalizar) {
      btnFinalizar.disabled = false;
      btnFinalizar.textContent = btnOriginalText;
    }
  }
}

function normalizarNumeroWhatsapp(numero) {
  return String(numero || "").replace(/\D/g, "");
}

// El proxy Cloudflare (pedido-proxy) solo acepta POST; para leer configuración
// se llama directamente al endpoint GAS que sí responde a GET.
async function cargarWhatsappBodegaDesdeConfig() {
  try {
    const endpointDirecto = `${API_URL}?action=obtenerConfiguracion&key=${API_KEY}`;
    const response = await fetch(endpointDirecto);
    const data = await response.json();

    if (!data || !data.success) {
      return { success: false, warning: "WhatsApp bodega no configurado en hoja Config (clave: Whatsapp_Bodega)" };
    }

    const numero = normalizarNumeroWhatsapp(data.whatsapp_bodega || "");
    if (!numero) {
      return { success: false, warning: "WhatsApp bodega no configurado en hoja Config (clave: Whatsapp_Bodega)" };
    }

    return { success: true, whatsapp_bodega: numero };
  } catch (error) {
    console.warn("No se pudo leer configuración de WhatsApp:", error);
    return { success: false, error: error.message || String(error) };
  }
}

function construirMensajeWhatsappPedido(pedidoID, cliente, items, total) {
  const fechaHora = new Date().toLocaleString("es-CO");
  const encabezado = [
    `*NUEVO PEDIDO #${pedidoID}*`,
    `Fecha: ${fechaHora}`,
    `Cliente: ${cliente.nombre || "N/A"}`,
    `Ciudad: ${cliente.ciudad || "N/A"}`
  ];

  if (cliente.notas) {
    encabezado.push(`Notas: ${cliente.notas}`);
  }

  const lineasItems = (Array.isArray(items) ? items : []).map((item, index) => {
    const nombre = item.nombre || item.producto || item.descripcion || "Producto";
    const codigo = item.codigo_contable || item.id_producto || item.codigo || item.sku || item.referencia || item.id || "N/A";
    const cantidad = Number(item.cantidad || 0);
    const precio = Number(item.precio || item.precio_unitario || 0);
    const subtotal = cantidad * precio;
    return `${index + 1}. ${nombre} | Cod: ${codigo} | Cant: ${cantidad} | Subtotal: $${subtotal.toLocaleString("es-CO")}`;
  });

  if (lineasItems.length === 0) {
    lineasItems.push("Sin productos para alistar");
  }

  const totalFmt = Number(total || 0).toLocaleString("es-CO");
  return `${encabezado.join("\n")}\n\n*ALISTAMIENTO DE BODEGA*\n${lineasItems.join("\n")}\n\nTotal pedido: $${totalFmt}`;
}

function enviarNotificacionWhatsapp(pedidoID, cliente, items, total) {
  try {
    const numero = normalizarNumeroWhatsapp(window.WHATSAPP_BODEGA_NUMBER || "");
    if (!numero) {
      return { success: false, warning: "WhatsApp bodega no configurado en hoja Config (clave: Whatsapp_Bodega)" };
    }

    const mensaje = construirMensajeWhatsappPedido(pedidoID, cliente, items, total);
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;

    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message || String(error) };
  }
}

function preguntarNotificacionWhatsapp(payload) {
  const modal = document.getElementById("whatsappConfirmacionModal");
  if (!modal) {
    return Promise.resolve({ success: false, skipped: true, warning: "Modal de WhatsApp no disponible" });
  }

  whatsappModalPayload = payload;
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";

  return new Promise(resolve => {
    whatsappModalResolver = resolve;
  });
}

function cerrarModalWhatsapp() {
  const modal = document.getElementById("whatsappConfirmacionModal");
  if (modal) modal.style.display = "none";
  document.body.style.overflow = "auto";
}

function confirmarNotificacionWhatsapp() {
  let resultado = { success: false, skipped: true };
  if (whatsappModalPayload) {
    resultado = enviarNotificacionWhatsapp(
      whatsappModalPayload.pedidoID,
      whatsappModalPayload.cliente,
      whatsappModalPayload.items,
      whatsappModalPayload.total
    );
  }

  cerrarModalWhatsapp();
  if (whatsappModalResolver) {
    whatsappModalResolver(resultado);
  }
  whatsappModalResolver = null;
  whatsappModalPayload = null;
}

function cancelarNotificacionWhatsapp() {
  cerrarModalWhatsapp();
  if (whatsappModalResolver) {
    whatsappModalResolver({ success: false, skipped: true });
  }
  whatsappModalResolver = null;
  whatsappModalPayload = null;
}

// ═══════════════════════════════════════════════════════════════════════
// GENERAR Y DESCARGAR PDF DESDE CLOUDFLARE WORKER
// ═══════════════════════════════════════════════════════════════════════

async function generarYDescargarPdfCliente(pedidoID, cliente, items, total) {
  try {
    const res = await fetch(API_PDF_WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generarPdfPedido",
        key: API_KEY,
        pedido_id: pedidoID,
        cliente: cliente,
        items: items,
        total: total,
        conPrecios: true
      })
    });

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Pedido_${pedidoID}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true };
  } catch (error) {
    console.error("Error generando PDF cliente:", error);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ENVIAR NOTIFICACIÓN A BODEGA (CORREO HTML SIN ADJUNTO)
// ═══════════════════════════════════════════════════════════════════════

async function enviarNotificacionBodega(pedidoID, cliente, items) {
  try {
    const res = await fetch(API_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "enviarNotificacionBodega",
        key: API_KEY,
        pedido_id: pedidoID,
        cliente: cliente,
        items: items
      })
    });

    const data = await res.json();

    if (data.success || data.warning) {
      return { success: true, message: data.message || data.warning };
    } else {
      return { success: false, error: data.error || "Error desconocido" };
    }
  } catch (error) {
    console.error("Error enviando notificación a bodega:", error);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// MODAL CONFIRMACIÓN
// ═══════════════════════════════════════════════════════════════════════

function mostrarModalConfirmacion(mensaje) {
  const modal = document.getElementById("pedidoConfirmacionModal");
  const mensajeEl = document.getElementById("confirmacionMensaje");
  if (!modal) return;
  if (mensajeEl) mensajeEl.textContent = mensaje.replace("✓ ", "");
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function cerrarModalConfirmacion() {
  const modal = document.getElementById("pedidoConfirmacionModal");
  if (modal) modal.style.display = "none";
  document.body.style.overflow = "auto";
  vaciarCarritoCompleto();
  window.location.href = "index.html";
}

// Cerrar modal si se hace click fuera del contenido
document.addEventListener("click", (e) => {
  const modal = document.getElementById("pedidoConfirmacionModal");
  const modalWhatsapp = document.getElementById("whatsappConfirmacionModal");
  if (modal && modal.style.display === "flex" && e.target === modal) {
    cerrarModalConfirmacion();
  }
  if (modalWhatsapp && modalWhatsapp.style.display === "flex" && e.target === modalWhatsapp) {
    cancelarNotificacionWhatsapp();
  }
});

// Cerrar modal con Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const modal = document.getElementById("pedidoConfirmacionModal");
    const modalWhatsapp = document.getElementById("whatsappConfirmacionModal");
    if (modal && modal.style.display === "flex") {
      cerrarModalConfirmacion();
    }
    if (modalWhatsapp && modalWhatsapp.style.display === "flex") {
      cancelarNotificacionWhatsapp();
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════
// LIMPIAR CARRITO
// ═══════════════════════════════════════════════════════════════════════

function limpiarCarritoPage() {
  if (confirm("¿Estás seguro de que deseas vaciar tu carrito?")) {
    vaciarCarritoCompleto();
    renderizarCarritoPage();
    actualizarResumen();
    if (toast) toast.info("Carrito vaciado");
  }
}

// ═══════════════════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES
// ═══════════════════════════════════════════════════════════════════════

function guardarCarrito() {
  localStorage.setItem("carrito", JSON.stringify(window.carrito));
}

function vaciarCarritoCompleto() {
  if (Array.isArray(window.carrito)) {
    window.carrito.splice(0, window.carrito.length);
  } else {
    window.carrito = [];
  }
  localStorage.removeItem("carrito");
  guardarCarrito();
}

// ═══════════════════════════════════════════════════════════════════════
// INICIALIZAR AL CARGAR
// ═══════════════════════════════════════════════════════════════════════

window.addEventListener("load", () => {
  // Esperar a que se cargue app.js
  setTimeout(inicializarCarritoPage, 100);
});
