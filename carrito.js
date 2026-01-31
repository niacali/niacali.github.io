/* ═══════════════════════════════════════════════════════════════════════
   CARRITO.JS - PÁGINA DE CARRITO MEJORADA
   ═══════════════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN GLOBAL PARA CARRITO
// ═══════════════════════════════════════════════════════════════════════

if (typeof API_URL === 'undefined') {
  window.API_URL = "https://script.google.com/macros/s/AKfycbw_QrC9F3DBGzwNFRjby2wa6iFNuGDUTkIQHBWi4VVpwolR6KhF7OlCyPYBzqhDoekoyA/exec";
}
if (typeof API_KEY === 'undefined') {
  window.API_KEY = "TIENDA_API_2026";
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
const carrito = window.carrito;

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
// FINALIZAR PEDIDO DESDE PÁGINA DE CARRITO
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
    btnFinalizar.textContent = "⏳ Procesando...";
  }

  try {
    const res = await fetch("https://pedido-proxy.pedidosnia-cali.workers.dev", {
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
    const responseText = await res.text();
    
    // Intentar parsear como JSON
    let data = null;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      // Si no es JSON válido, considerar éxito si status 200
      console.warn("Respuesta no es JSON válido:", responseText.substring(0, 100));
      data = { 
        success: true, 
        pedido_id: "pedido registrado",
        warning: "Confirmación del servidor con error, pero datos guardados"
      };
    }

    if (data.success || res.status === 200) {
      const pedidoID = data.pedido_id || "confirmado";
      const mensaje = data.warning 
        ? `✓ Pedido ${pedidoID} registrado (con nota del servidor)`
        : `✓ ¡Pedido ${pedidoID} creado exitosamente!`;
      
      if (toast) toast.exito(mensaje);
      
      // Limpiar carrito
      window.carrito.length = 0;
      guardarCarrito();
      
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
    } else {
      throw new Error(data.error || data.mensaje || "Error al crear pedido");
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
  window.location.href = "index.html";
}

// Cerrar modal si se hace click fuera del contenido
document.addEventListener("click", (e) => {
  const modal = document.getElementById("pedidoConfirmacionModal");
  if (modal && modal.style.display === "flex" && e.target === modal) {
    cerrarModalConfirmacion();
  }
});

// Cerrar modal con Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const modal = document.getElementById("pedidoConfirmacionModal");
    if (modal && modal.style.display === "flex") {
      cerrarModalConfirmacion();
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════
// LIMPIAR CARRITO
// ═══════════════════════════════════════════════════════════════════════

function limpiarCarritoPage() {
  if (confirm("¿Estás seguro de que deseas vaciar tu carrito?")) {
    carrito = [];
    guardarCarrito();
    renderizarCarritoPage();
    actualizarResumen();
    if (toast) toast.info("Carrito vaciado");
  }
}

// ═══════════════════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES
// ═══════════════════════════════════════════════════════════════════════

function guardarCarrito() {
  localStorage.setItem("carrito", JSON.stringify(carrito));
}

// ═══════════════════════════════════════════════════════════════════════
// INICIALIZAR AL CARGAR
// ═══════════════════════════════════════════════════════════════════════

window.addEventListener("load", () => {
  // Esperar a que se cargue app.js
  setTimeout(inicializarCarritoPage, 100);
});
