/* ═══════════════════════════════════════════════════════════════════════
   ADMIN.JS - PANEL DE ADMINISTRACIÓN
   ═══════════════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN GLOBAL PARA ADMIN
// ═══════════════════════════════════════════════════════════════════════

const API_URL = "https://script.google.com/macros/s/AKfycbyJ7sXc6UYELvY56e8j7C2BYty01cSnSmWXFYzMY22egfq9IpnhRxEYtDSTgFSq1A71/exec";
const API_PROXY_URL = "https://pedido-proxy.pedidosnia-cali.workers.dev";
const API_KEY = "TIENDA_API_2026";

// ═══════════════════════════════════════════════════════════════════════
// AUTENTICACIÓN GLOBAL (PARA EVITAR ERRORES DE TIMING)
// ═══════════════════════════════════════════════════════════════════════

function autenticar(event) {
  event.preventDefault();

  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;

  // Credenciales de acceso (hardcodeadas para evitar problemas de timing)
  const usuarios = [
    { username: "admin@niacali.com", password: "admin1234", rol: "admin" },
    { username: "auxiliar@niacali.com", password: "auxiliar1234", rol: "admin" },
    { username: "soporte@niacali.com", password: "soporte1234", rol: "admin" }
  ];

  // Validar credenciales
  const usuario = usuarios.find(
    u => u.username === username && u.password === password
  );

  if (!usuario) {
    console.error("Credenciales inválidas");
    alert("Credenciales inválidas");
    return;
  }

  // Autenticar
  window.adminAutenticado = true;
  window.adminUsuario = usuario;

  // Guardar en localStorage
  localStorage.setItem("adminToken", btoa(JSON.stringify(usuario)));
  localStorage.setItem("adminUsername", usuario.username);

  console.log("¡Sesión iniciada!");
  alert("¡Sesión iniciada!");

  // Mostrar panel admin
  const loginPanel = document.getElementById("loginPanel");
  const adminPanel = document.getElementById("adminPanel");

  if (loginPanel) loginPanel.style.display = "none";
  if (adminPanel) adminPanel.style.display = "block";
}

document.addEventListener('DOMContentLoaded', function() {

// ═══════════════════════════════════════════════════════════════════════
// ELEMENTOS DEL DOM
// ═══════════════════════════════════════════════════════════════════════

const loginPanel = document.getElementById("loginPanel");
const adminPanel = document.getElementById("adminPanel");
const btnLogout = document.getElementById("btnLogout");
const adminTabs = document.querySelectorAll(".admin-tab-btn");
const pedidoSearch = document.getElementById("pedidoSearch");
const pedidoEstadoFiltro = document.getElementById("pedidoEstadoFiltro");

// ═══════════════════════════════════════════════════════════════════════
// VARIABLES GLOBALES
// ═══════════════════════════════════════════════════════════════════════

let adminAutenticado = false;
let adminUsuario = null;
let pedidosAdmin = [];
let productosAdmin = [];
let categoriasAdmin = [];
let pedidoEnEdicion = null;
let productoEnEdicion = null;
let categoriaEnEdicion = null;
let pedidosFiltroTexto = "";
let pedidosFiltroEstado = "pendiente";

// ═══════════════════════════════════════════════════════════════════════
// AUTENTICACIÓN
// ═══════════════════════════════════════════════════════════════════════

function cerrarSesion() {
  if (confirm("¿Deseas cerrar la sesión?")) {
    adminAutenticado = false;
    adminUsuario = null;
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUsername");

    // Mostrar login
    loginPanel.style.display = "flex";
    adminPanel.style.display = "none";
    btnLogout.style.display = "none";

    // Limpiar formulario
    document.getElementById("formLogin").reset();

    if (toast) toast.info("Sesión cerrada");
  }
}

// ═══════════════════════════════════════════════════════════════════════
// MOSTRAR/OCULTAR PANELES
// ═══════════════════════════════════════════════════════════════════════

function mostrarPanelAdmin() {
  loginPanel.style.display = "none";
  adminPanel.style.display = "block";
  btnLogout.style.display = "block";
  if (document.getElementById("correoBodega")) {
    cargarCorreoBodega();
  }
}

function verificarAutenticacion() {
  const token = localStorage.getItem("adminToken");
  if (token) {
    try {
      const usuario = JSON.parse(atob(token));
      adminAutenticado = true;
      adminUsuario = usuario;
      mostrarPanelAdmin();
      cargarPedidosAdmin();
      cargarProductosAdmin();
      cargarCategoriasAdmin();
    } catch (e) {
      localStorage.removeItem("adminToken");
    }
  }
}

function aplicarFiltrosPedidos() {
  const texto = pedidosFiltroTexto.trim().toLowerCase();
  const estado = pedidosFiltroEstado.trim().toLowerCase();

  const filtrados = pedidosAdmin.filter(pedido => {
    const coincideTexto = !texto || [
      pedido.id,
      pedido.cliente,
      pedido.ciudad
    ].some(valor => String(valor || "").toLowerCase().includes(texto));

    const estadoPedido = String(pedido.estado || "pendiente").toLowerCase();
    const coincideEstado = !estado || estadoPedido === estado;

    return coincideTexto && coincideEstado;
  });

  renderizarPedidosAdmin(filtrados);
}

// ═══════════════════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════════════════

adminTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const tabName = tab.dataset.tab;

    // Remover clase active de todos los tabs
    adminTabs.forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".admin-tab-content").forEach(content => {
      content.classList.remove("active");
    });

    // Agregar clase active al tab seleccionado
    tab.classList.add("active");
    document.getElementById(`tab-${tabName}`).classList.add("active");
  });
});

if (pedidoSearch) {
  pedidoSearch.addEventListener("input", (event) => {
    pedidosFiltroTexto = event.target.value || "";
    aplicarFiltrosPedidos();
  });
}

if (pedidoEstadoFiltro) {
  pedidoEstadoFiltro.value = pedidosFiltroEstado;
  pedidoEstadoFiltro.addEventListener("change", (event) => {
    pedidosFiltroEstado = event.target.value || "";
    aplicarFiltrosPedidos();
  });
}

// ═══════════════════════════════════════════════════════════════════════
// CARGAR PEDIDOS
// ═══════════════════════════════════════════════════════════════════════

async function cargarPedidosAdmin() {
  try {
    const response = await fetch(`${API_URL}?action=getPedidos&key=${API_KEY}`);
    const data = await response.json();

    console.log("Datos recibidos del backend:", data);

    if (Array.isArray(data)) {
      pedidosAdmin = data;
    } else if (data.items && Array.isArray(data.items)) {
      pedidosAdmin = data.items;
    } else if (data.data && Array.isArray(data.data)) {
      pedidosAdmin = data.data;
    } else {
      throw data?.error || "Respuesta inválida";
    }

    console.log("Pedidos procesados:", pedidosAdmin);
    aplicarFiltrosPedidos();
    console.log(`✓ ${pedidosAdmin.length} pedidos cargados`);
  } catch (error) {
    console.error("Error al cargar pedidos:", error);
    pedidosAdmin = [];
    renderizarPedidosAdmin([]);
    if (window.toast) window.toast.error("Error de conexión al cargar pedidos");
  }
}

function renderizarPedidosAdmin(lista = pedidosAdmin) {
  const listaPedidos = document.getElementById("listaPedidos");
  const pedidosVacio = document.getElementById("pedidosVacio");

  if (!lista || lista.length === 0) {
    listaPedidos.style.display = "none";
    pedidosVacio.style.display = "flex";
    return;
  }

  listaPedidos.style.display = "block";
  pedidosVacio.style.display = "none";
  
  const rows = lista.map((pedido, index) => {
    const idPedido = pedido.id_pedido ?? pedido.pedido_id ?? pedido.id ?? "";
    const idDisplay = idPedido !== "" ? idPedido : "N/A";
    
    const estadoRaw = pedido.estado ? String(pedido.estado).trim().toLowerCase() : "";
    const estado = estadoRaw || "en proceso";
    const cliente = pedido.cliente ? String(pedido.cliente).trim() : "N/A";
    const ciudad = pedido.ciudad ? String(pedido.ciudad).trim() : "N/A";
    const total = Number(pedido.total || 0).toLocaleString();
    
    let fechaFormateada = "N/A";
    if (pedido.fecha) {
      try {
        const date = new Date(pedido.fecha);
        if (!isNaN(date.getTime())) {
          fechaFormateada = date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
        } else {
          fechaFormateada = String(pedido.fecha).substring(0, 16);
        }
      } catch {
        fechaFormateada = String(pedido.fecha).substring(0, 16);
      }
    }
    
    const realIndex = pedidosAdmin.findIndex(p =>
      (p.id_pedido && pedido.id_pedido && p.id_pedido == pedido.id_pedido) ||
      (p.pedido_id && pedido.pedido_id && p.pedido_id == pedido.pedido_id) ||
      (p.id && pedido.id && p.id == pedido.id) ||
      (p.cliente === pedido.cliente && p.fecha === pedido.fecha)
    );
    
    return `
      <tr>
        <td class="pedido-id">#${idDisplay}</td>
        <td>${cliente}</td>
        <td>${fechaFormateada}</td>
        <td>${ciudad}</td>
        <td>$ ${total}</td>
        <td><span class="pedido-estado ${estado}">${estado}</span></td>
        <td class="pedido-row-actions">
          <button onclick="verDetallePedido('${idPedido}')" class="btn-icon btn-icon-view" title="Ver detalle" aria-label="Ver detalle del pedido ${idDisplay}">
            <span class="material-symbols-outlined btn-icon-symbol">visibility</span>
          </button>
          <button onclick="imprimirPedido(${realIndex >= 0 ? realIndex : index})" class="btn-icon btn-icon-print" title="Imprimir" aria-label="Imprimir pedido ${idDisplay}">
            <span class="material-symbols-outlined btn-icon-symbol">print</span>
          </button>
          <button onclick="reenviarCorreoBodega(${realIndex >= 0 ? realIndex : index}, event)" class="btn-icon btn-icon-mail" title="Reenviar alistamiento a bodega" aria-label="Reenviar correo de alistamiento del pedido ${idDisplay}">
            <span class="material-symbols-outlined btn-icon-symbol">forward_to_inbox</span>
          </button>
          <button onclick="exportarPedidoCSV(${realIndex >= 0 ? realIndex : index})" class="btn-icon btn-icon-export" title="Exportar CSV" aria-label="Exportar pedido ${idDisplay} en CSV">
            <span class="material-symbols-outlined btn-icon-symbol">download</span>
          </button>
        </td>
      </tr>
    `;
  }).join("");
  
  listaPedidos.innerHTML = `
    <div class="pedidos-table-wrapper">
      <table class="pedidos-table">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Cliente</th>
            <th>Fecha</th>
            <th>Ciudad</th>
            <th>Total</th>
            <th>Estado</th>
            <th class="th-acciones">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function refrescarPedidos() {
  cargarPedidosAdmin();
  if (toast) toast.info("Pedidos actualizados");
}

// ═══════════════════════════════════════════════════════════════════════
// EDITAR PEDIDO
// ═══════════════════════════════════════════════════════════════════════

async function verDetallePedido(idPedido) {
  try {
    // Buscar el pedido en el array
    const pedido = pedidosAdmin.find(p =>
      (p.id_pedido && p.id_pedido == idPedido) ||
      (p.pedido_id && p.pedido_id == idPedido) ||
      (p.id && p.id == idPedido)
    );
    
    if (!pedido) {
      if (window.toast) window.toast.error("Pedido no encontrado");
      return;
    }

    pedidoEnEdicion = idPedido;

    // Cargar detalle del pedido desde la API
    let items = [];
    try {
      const response = await fetch(`${API_URL}?action=getPedidoDetalle&key=${API_KEY}&idPedido=${idPedido}`);
      const data = await response.json();

      if (Array.isArray(data)) {
        items = data;
      } else if (data.items && Array.isArray(data.items)) {
        items = data.items;
      } else if (data.data && Array.isArray(data.data)) {
        items = data.data;
      } else {
        items = [];
      }
    } catch (error) {
      console.error("Error al cargar detalle del pedido:", error);
      items = [];
    }

    // Actualizar información del pedido en el modal
    document.getElementById("pedidoId").textContent = pedido.id_pedido || pedido.pedido_id || pedido.id;
    document.getElementById("pedidoCliente").textContent = pedido.cliente;
    document.getElementById("pedidoFecha").textContent = pedido.fecha || "N/A";
    document.getElementById("pedidoTotal").textContent = `$ ${Number(pedido.total || 0).toLocaleString()}`;
    document.getElementById("pedidoCiudad").textContent = pedido.ciudad || "N/A";
    document.getElementById("pedidoTelefono").textContent = pedido.telefono || "N/A";
    document.getElementById("pedidoDireccion").textContent = pedido.direccion || "N/A";
    document.getElementById("selectEstado").value = pedido.estado || "pendiente";

    // Renderizar items del pedido
    const tablaItems = document.getElementById("tablaItemsPedido");
    tablaItems.innerHTML = "";

    if (items.length === 0) {
      tablaItems.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 20px; color: #888;">
            No hay items en este pedido
          </td>
        </tr>
      `;
    } else {
      items.forEach(item => {
        const nombreItem = item.producto || item.nombre || "Producto";
        const cantidadItem = Number(item.cantidad || 0);
        const precioUnitario = Number(item.precio_unitario ?? item.precio ?? 0);
        const subtotalItem = Number(item.total_venta ?? item.subtotal ?? (precioUnitario * cantidadItem));
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${nombreItem}</td>
          <td style="text-align: center;">${cantidadItem}</td>
          <td style="text-align: right;">$ ${precioUnitario.toLocaleString()}</td>
          <td style="text-align: right;">$ ${subtotalItem.toLocaleString()}</td>
        `;
        tablaItems.appendChild(tr);
      });
    }

    // Mostrar modal
    document.getElementById("modalDetallePedido").style.display = "flex";
  } catch (error) {
    console.error("Error al cargar detalle del pedido:", error);
    if (window.toast) window.toast.error("Error de conexión");
  }
}

function cerrarModalDetallePedido() {
  document.getElementById("modalDetallePedido").style.display = "none";
  pedidoEnEdicion = null;
}

function cerrarModalEditarPedido() {
  cerrarModalDetallePedido();
}

function obtenerPedidoAdminPorId(idPedido) {
  if (idPedido === null || idPedido === undefined || idPedido === "") {
    return null;
  }

  return pedidosAdmin.find(p =>
    (p.id_pedido && p.id_pedido == idPedido) ||
    (p.pedido_id && p.pedido_id == idPedido) ||
    (p.id && p.id == idPedido)
  ) || null;
}

function obtenerToastAdmin() {
  if (window.toast) return window.toast;
  if (window.parent && window.parent.toast) return window.parent.toast;
  if (typeof toast !== "undefined") return toast;
  return null;
}

async function guardarCambioPedido(event) {
  if (pedidoEnEdicion === null) return;

  const toastAdmin = obtenerToastAdmin();
  const botonGuardar = event?.currentTarget || event?.target || document.querySelector("button[onclick*='guardarCambioPedido']");
  const textoOriginal = botonGuardar ? botonGuardar.textContent : "";

  const nuevoEstado = document.getElementById("selectEstado").value;
  
  const pedido = obtenerPedidoAdminPorId(pedidoEnEdicion);
  if (!pedido) {
    if (toastAdmin && toastAdmin.error) {
      toastAdmin.error("Pedido no encontrado");
    } else {
      alert("Pedido no encontrado");
    }
    return;
  }

  const idPedido = pedido.id_pedido || pedido.pedido_id || pedido.id;

  try {
    if (botonGuardar) {
      botonGuardar.disabled = true;
      botonGuardar.textContent = "⏳ Guardando...";
    }

    await actualizarEstadoPedidoAdmin(idPedido, nuevoEstado);
    pedido.estado = nuevoEstado;
    await cargarPedidosAdmin();

    if (toastAdmin && toastAdmin.exito) {
      toastAdmin.exito(`Estado del pedido #${idPedido} actualizado a ${nuevoEstado}`);
    } else {
      alert(`Estado del pedido #${idPedido} actualizado a ${nuevoEstado}`);
    }

    cerrarModalDetallePedido();
  } catch (error) {
    console.error("Error guardando cambio de estado:", error);
    if (toastAdmin && toastAdmin.error) {
      toastAdmin.error(error.message || "No se pudo guardar el estado del pedido");
    } else {
      alert(error.message || "No se pudo guardar el estado del pedido");
    }
  } finally {
    if (botonGuardar) {
      botonGuardar.disabled = false;
      botonGuardar.textContent = textoOriginal;
    }
  }
}

async function imprimirPedidoActual() {
  if (pedidoEnEdicion === null) return;
  const pedido = obtenerPedidoAdminPorId(pedidoEnEdicion);
  if (!pedido) return;
  await imprimirPedidoData(pedido);
}

async function imprimirPedido(index) {
  const pedido = pedidosAdmin[index];
  await imprimirPedidoData(pedido);
}

async function reenviarCorreoBodega(index, event) {
  const pedido = pedidosAdmin[index];
  if (!pedido) {
    const toastAdmin = obtenerToastAdmin();
    if (toastAdmin && toastAdmin.error) {
      toastAdmin.error("Pedido no encontrado");
    } else {
      alert("Pedido no encontrado");
    }
    return;
  }

  const boton = event?.target?.closest ? event.target.closest("button") : (event?.currentTarget || event?.target || null);
  await reenviarCorreoBodegaData(pedido, boton);
}

async function reenviarCorreoBodegaActual(event) {
  if (pedidoEnEdicion === null) {
    const toastAdmin = obtenerToastAdmin();
    if (toastAdmin && toastAdmin.error) {
      toastAdmin.error("No hay pedido seleccionado");
    } else {
      alert("No hay pedido seleccionado");
    }
    return;
  }

  const pedido = obtenerPedidoAdminPorId(pedidoEnEdicion);

  if (!pedido) {
    const toastAdmin = obtenerToastAdmin();
    if (toastAdmin && toastAdmin.error) {
      toastAdmin.error("Pedido no encontrado");
    } else {
      alert("Pedido no encontrado");
    }
    return;
  }

  const boton = event?.target?.closest ? event.target.closest("button") : (event?.currentTarget || event?.target || null);
  await reenviarCorreoBodegaData(pedido, boton);
}

async function reenviarCorreoBodegaData(pedido, boton) {
  const toastAdmin = obtenerToastAdmin();
  const idPedido = pedido.id_pedido || pedido.pedido_id || pedido.id;
  if (!idPedido) {
    if (toastAdmin && toastAdmin.error) {
      toastAdmin.error("No se pudo identificar el pedido");
    } else {
      alert("No se pudo identificar el pedido");
    }
    return;
  }

  const textoOriginal = boton ? boton.textContent : "";
  const esBotonIcono = Boolean(boton && boton.classList && boton.classList.contains("btn-icon"));
  if (boton) {
    boton.disabled = true;
    boton.setAttribute("aria-busy", "true");
    if (esBotonIcono) {
      boton.style.opacity = "0.65";
    } else {
      boton.textContent = "📤 Reenviando...";
    }
  }

  try {
    const items = await obtenerDetallePedido(idPedido);
    if (!items || items.length === 0) {
      throw new Error("El pedido no tiene items para enviar");
    }

    const clientePayload = {
      nombre: pedido.cliente || "N/A",
      ciudad: pedido.ciudad || "N/A",
      telefono: pedido.telefono || "No proporcionado",
      notas: pedido.notas || pedido.observaciones || ""
    };

    const response = await fetch(API_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "enviarNotificacionBodega",
        key: API_KEY,
        pedido_id: idPedido,
        cliente: clientePayload,
        items
      })
    });

    const data = await response.json();

    if (data.success) {
      if (toastAdmin && toastAdmin.exito) {
        toastAdmin.exito(`Correo reenviado a bodega para pedido #${idPedido}`);
      } else {
        alert(`Correo reenviado a bodega para pedido #${idPedido}`);
      }
      return;
    }

    if (data.warning) {
      if (toastAdmin && toastAdmin.info) {
        toastAdmin.info(data.warning);
      } else {
        alert(data.warning);
      }
      return;
    }

    throw new Error(data.error || "No se pudo reenviar el correo");
  } catch (error) {
    console.error("Error reenviando correo de bodega:", error);
    if (toastAdmin && toastAdmin.error) {
      toastAdmin.error(`Error al reenviar: ${error.message || error}`);
    } else {
      alert(`Error al reenviar: ${error.message || error}`);
    }
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.removeAttribute("aria-busy");
      if (esBotonIcono) {
        boton.style.opacity = "";
      } else {
        boton.textContent = textoOriginal;
      }
    }
  }
}

async function obtenerDetallePedido(idPedido) {
  try {
    const response = await fetch(`${API_URL}?action=getPedidoDetalle&key=${API_KEY}&idPedido=${idPedido}`);
    const data = await response.json();

    if (Array.isArray(data)) return data;
    if (data.items && Array.isArray(data.items)) return data.items;
    if (data.data && Array.isArray(data.data)) return data.data;
    return [];
  } catch (error) {
    console.error("Error al obtener detalle del pedido:", error);
    return [];
  }
}

async function imprimirPedidoData(pedido) {
  const items = await obtenerDetallePedido(pedido.id_pedido || pedido.pedido_id || pedido.id);
  const filasItems = items.length > 0
    ? items.map(item => {
        const nombreItem = item.producto || item.nombre || "Producto";
        const cantidadItem = Number(item.cantidad || 0);
        const precioUnitario = Number(item.precio_unitario ?? item.precio ?? 0);
        const subtotalItem = Number(item.total_venta ?? item.subtotal ?? (precioUnitario * cantidadItem));

        return `
          <tr>
            <td>${nombreItem}</td>
            <td style="text-align: center;">${cantidadItem}</td>
            <td style="text-align: right;">$ ${precioUnitario.toLocaleString()}</td>
            <td style="text-align: right;">$ ${subtotalItem.toLocaleString()}</td>
          </tr>
        `;
      }).join("")
    : `
        <tr>
          <td colspan="4" style="text-align: center; padding: 12px; color: #666;">No hay items en este pedido</td>
        </tr>
      `;

  const contenido = `
    <h2>PEDIDO #${pedido.id_pedido || pedido.pedido_id || pedido.id}</h2>
    <p><strong>Cliente:</strong> ${pedido.cliente}</p>
    <p><strong>Ciudad:</strong> ${pedido.ciudad || "N/A"}</p>
    <p><strong>Teléfono:</strong> ${pedido.telefono || "N/A"}</p>
    <p><strong>Dirección:</strong> ${pedido.direccion || "N/A"}</p>
    <p><strong>Fecha:</strong> ${pedido.fecha || "N/A"}</p>
    <p><strong>Estado:</strong> ${pedido.estado || "pendiente"}</p>
    <p><strong>Total:</strong> $ ${Number(pedido.total || 0).toLocaleString()}</p>

    <h3 style="margin-top: 24px;">📦 Items del Pedido</h3>
    <table>
      <thead>
        <tr>
          <th>Producto</th>
          <th style="text-align: center;">Cantidad</th>
          <th style="text-align: right;">Precio Unit.</th>
          <th style="text-align: right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${filasItems}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="text-align: right; font-weight: 700;">TOTAL:</td>
          <td style="text-align: right; font-weight: 700;">$ ${Number(pedido.total || 0).toLocaleString()}</td>
        </tr>
      </tfoot>
    </table>
  `;

  const ventana = window.open("", "Imprimir Pedido", "width=800,height=600");
  ventana.document.write(`
    <html>
      <head>
        <title>Pedido #${pedido.id_pedido || pedido.pedido_id || pedido.id}</title>
        <style>
          body { font-family: Arial; margin: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        </style>
      </head>
      <body>${contenido}</body>
    </html>
  `);
  ventana.document.close();
  ventana.print();
}

function eliminarPedido(index) {
  if (confirm("¿Estás seguro de que deseas eliminar este pedido?")) {
    pedidosAdmin.splice(index, 1);
    renderizarPedidosAdmin();
    if (toast) toast.exito("Pedido eliminado");
  }
}

// ═══════════════════════════════════════════════════════════════════════
// CARGAR PRODUCTOS
// ═══════════════════════════════════════════════════════════════════════

function cargarProductosAdmin() {
  fetch(API_URL + "?action=obtenerProductos&apiKey=" + API_KEY)
    .then(response => response.json())
    .then(data => {
      if (data.success && data.productos) {
        productosAdmin = data.productos;
        renderizarProductosAdmin();
      }
    })
    .catch(error => {
      console.error("Error al cargar productos:", error);
      productosAdmin = obtenerProductosDemo();
      renderizarProductosAdmin();
    });
}

function renderizarProductosAdmin() {
  const listaProductos = document.getElementById("listaProductosAdmin");
  const productosVacio = document.getElementById("productosVacio");

  if (!productosAdmin || productosAdmin.length === 0) {
    listaProductos.style.display = "none";
    productosVacio.style.display = "flex";
    return;
  }

  listaProductos.style.display = "grid";
  productosVacio.style.display = "none";
  listaProductos.innerHTML = "";

  productosAdmin.forEach((producto, index) => {
    const productoDiv = document.createElement("div");
    productoDiv.className = `producto-admin-card status-${producto.status || 'activo'}`;

    productoDiv.innerHTML = `
      <div class="producto-admin-imagen">
        <img src="${producto.imagen}" alt="${producto.nombre}" loading="lazy">
        <span class="status-badge">${producto.status || "activo"}</span>
      </div>

      <div class="producto-admin-info">
        <h3>${producto.nombre}</h3>
        <p class="categoria">${producto.categoria}</p>
        <p class="precio">$ ${Number(producto.precio).toLocaleString()}</p>
        <p class="stock">Stock: ${producto.stock || 0}</p>
      </div>

      <div class="producto-admin-acciones">
        <button onclick="abrirEditarProducto(${index})" class="btn btn-small">
          ✎ Editar
        </button>
        <button onclick="eliminarProducto(${index})" class="btn btn-small btn-danger">
          🗑 Eliminar
        </button>
      </div>
    `;

    listaProductos.appendChild(productoDiv);
  });
}

function abrirFormProducto() {
  productoEnEdicion = null;
  document.getElementById("editProductoNombre").value = "";
  document.getElementById("editProductoPrecio").value = "";
  document.getElementById("editProductoCategoria").value = "";
  document.getElementById("editProductoStock").value = "";
  document.getElementById("editProductoStatus").value = "activo";
  document.getElementById("editProductoEsNuevo").checked = false;
  document.getElementById("editProductoNuevoHasta").value = "";
  document.getElementById("modalEditarProducto").style.display = "flex";
}

function abrirEditarProducto(index) {
  productoEnEdicion = index;
  const producto = productosAdmin[index];

  document.getElementById("editProductoNombre").value = producto.nombre;
  document.getElementById("editProductoPrecio").value = producto.precio;
  document.getElementById("editProductoCategoria").value = producto.categoria;
  document.getElementById("editProductoStock").value = producto.stock || 0;
  document.getElementById("editProductoStatus").value = producto.status || "activo";
  document.getElementById("editProductoEsNuevo").checked = !!producto.es_nuevo;
  document.getElementById("editProductoNuevoHasta").value = producto.nuevo_hasta
    ? String(producto.nuevo_hasta).substring(0, 10)
    : "";

  document.getElementById("modalEditarProducto").style.display = "flex";
}

function cerrarModalEditarProducto() {
  document.getElementById("modalEditarProducto").style.display = "none";
  productoEnEdicion = null;
}

function guardarCambioProducto() {
  const nombre = document.getElementById("editProductoNombre").value.trim();
  const precio = parseFloat(document.getElementById("editProductoPrecio").value);
  const categoria = document.getElementById("editProductoCategoria").value.trim();
  const stock = parseInt(document.getElementById("editProductoStock").value);
  const status = document.getElementById("editProductoStatus").value;
  const es_nuevo = document.getElementById("editProductoEsNuevo").checked;
  const nuevo_hasta = document.getElementById("editProductoNuevoHasta").value || "";

  if (!nombre || !precio || !categoria) {
    if (toast) toast.error("Completa todos los campos requeridos");
    return;
  }

  if (productoEnEdicion === null) {
    // Nuevo producto
    const nuevoProducto = {
      id: productosAdmin.length + 1,
      nombre,
      precio,
      categoria,
      stock,
      status,
      es_nuevo,
      nuevo_hasta,
      imagen: "https://via.placeholder.com/200"
    };
    productosAdmin.push(nuevoProducto);
  } else {
    // Editar producto existente
    productosAdmin[productoEnEdicion].nombre = nombre;
    productosAdmin[productoEnEdicion].precio = precio;
    productosAdmin[productoEnEdicion].categoria = categoria;
    productosAdmin[productoEnEdicion].stock = stock;
    productosAdmin[productoEnEdicion].status = status;
    productosAdmin[productoEnEdicion].es_nuevo = es_nuevo;
    productosAdmin[productoEnEdicion].nuevo_hasta = nuevo_hasta;
  }

  // Sincronizar con API
  fetch(API_URL, {
    method: "POST",
    body: new URLSearchParams({
      action: "guardarProducto",
      apiKey: API_KEY,
      productoData: JSON.stringify(
        productoEnEdicion === null ? productosAdmin[productosAdmin.length - 1] : productosAdmin[productoEnEdicion]
      )
    })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        if (toast) toast.exito("Producto guardado");
        cerrarModalEditarProducto();
        renderizarProductosAdmin();
      } else {
        if (toast) toast.error("Error al guardar producto");
      }
    })
    .catch(error => {
      console.error("Error:", error);
      if (toast) toast.error("Error de conexión");
    });
}

function eliminarProducto(index) {
  if (confirm("¿Estás seguro de que deseas eliminar este producto?")) {
    productosAdmin.splice(index, 1);
    renderizarProductosAdmin();
    if (toast) toast.exito("Producto eliminado");
  }
}

// ═══════════════════════════════════════════════════════════════════════
// CATEGORÍAS
// ═══════════════════════════════════════════════════════════════════════

function cargarCategoriasAdmin() {
  fetch(`${API_URL}?action=getCategoriasAdmin&key=${API_KEY}`)
    .then(response => response.json())
    .then(data => {
      if (data && Array.isArray(data.items)) {
        categoriasAdmin = data.items;
        renderizarCategoriasAdmin();
      }
    })
    .catch(error => {
      console.error("Error al cargar categorías:", error);
      categoriasAdmin = [];
      renderizarCategoriasAdmin();
    });
}

function renderizarCategoriasAdmin() {
  const listaCategorias = document.getElementById("listaCategoriasAdmin");
  const categoriasVacio = document.getElementById("categoriasVacio");

  if (!categoriasAdmin || categoriasAdmin.length === 0) {
    listaCategorias.style.display = "none";
    categoriasVacio.style.display = "flex";
    return;
  }

  listaCategorias.style.display = "block";
  categoriasVacio.style.display = "none";
  let html = `<table class="admin-table-categorias">
    <thead>
      <tr>
        <th>Nombre</th>
        <th>ID</th>
        <th>Orden</th>
        <th>Estado</th>
        <th>Acciones</th>
      </tr>
    </thead>
    <tbody>`;
  categoriasAdmin.forEach((cat, index) => {
    html += `<tr class="estado-${cat.estado || 'activo'}">
      <td>${cat.nombre}</td>
      <td>${cat.id}</td>
      <td>${cat.orden || 0}</td>
      <td>
        <span class="estado-label estado-${cat.estado || 'activo'}">${cat.estado || 'activo'}</span>
      </td>
      <td>
        <button onclick="verCategoria(${index})" class="btn btn-small btn-outline">👁 Ver</button>
        <button onclick="abrirEditarCategoria(${index})" class="btn btn-small">✎ Editar</button>
        <button onclick="eliminarCategoria(${index})" class="btn btn-small btn-danger">🗑 Eliminar</button>
        <button onclick="desactivarCategoria(${index})" class="btn btn-small btn-warning">⏸ Desactivar</button>
      </td>
    </tr>`;
  });
  html += `</tbody></table>`;
  listaCategorias.innerHTML = html;
}

function abrirFormCategoria() {
  categoriaEnEdicion = null;
  document.getElementById("editCategoriaId").value = "";
  document.getElementById("editCategoriaNombre").value = "";
  document.getElementById("editCategoriaIcono").value = "";
  document.getElementById("editCategoriaOrden").value = 0;
  document.getElementById("editCategoriaEstado").value = "activo";
  document.getElementById("modalEditarCategoria").style.display = "flex";
}

function abrirEditarCategoria(index) {
  categoriaEnEdicion = index;
  const cat = categoriasAdmin[index];

  document.getElementById("editCategoriaId").value = cat.id || "";
  document.getElementById("editCategoriaNombre").value = cat.nombre || "";
  document.getElementById("editCategoriaIcono").value = cat.icono || "";
  document.getElementById("editCategoriaOrden").value = cat.orden || 0;
  document.getElementById("editCategoriaEstado").value = cat.estado || "activo";

  document.getElementById("modalEditarCategoria").style.display = "flex";
}

function cerrarModalEditarCategoria() {
  document.getElementById("modalEditarCategoria").style.display = "none";
  categoriaEnEdicion = null;
}

// ═══════════════════════════════════════════════════════════════════════
// FUNCIONES GLOBALES (PARA LLAMADAS DESDE HTML)
// ═══════════════════════════════════════════════════════════════════════

window.refrescarPedidos = function() {
  console.log("🔄 Refrescando pedidos...");
  cargarPedidosAdmin();
  const toast = window.toast || window.parent.toast;
  if (toast && toast.info) toast.info("Pedidos actualizados");
};

window.verDetallePedido = verDetallePedido;
window.cerrarModalDetallePedido = cerrarModalDetallePedido;
window.cerrarModalEditarPedido = cerrarModalEditarPedido;
window.guardarCambioPedido = guardarCambioPedido;
window.imprimirPedido = imprimirPedido;
window.imprimirPedidoActual = imprimirPedidoActual;
window.reenviarCorreoBodega = reenviarCorreoBodega;
window.reenviarCorreoBodegaActual = reenviarCorreoBodegaActual;

// Funciones de categorías
window.abrirFormCategoria = abrirFormCategoria;
window.abrirEditarCategoria = abrirEditarCategoria;
window.editarCategoria = editarCategoria;
window.cerrarModalEditarCategoria = cerrarModalEditarCategoria;
window.guardarCambioCategoria = guardarCambioCategoria;
window.eliminarCategoria = eliminarCategoria;
window.verCategoria = verCategoria;
window.desactivarCategoria = desactivarCategoria;

// Funciones de productos
window.abrirFormProducto = abrirFormProducto;
window.cerrarModalEditarProducto = cerrarModalEditarProducto;
window.guardarCambioProducto = guardarCambioProducto;

// Funciones de exportación
window.exportarPedidoCSV = exportarPedidoCSV;
window.exportarPedidosCSV = exportarPedidosCSV;
window.exportarPedidosJSON = exportarPedidosJSON;
window.exportarProductosCSV = exportarProductosCSV;
window.exportarProductosJSON = exportarProductosJSON;

function guardarCambioCategoria() {
  const id = document.getElementById("editCategoriaId").value.trim();
  const nombre = document.getElementById("editCategoriaNombre").value.trim();
  const icono = document.getElementById("editCategoriaIcono").value.trim();
  const orden = Number(document.getElementById("editCategoriaOrden").value || 0);
  const estado = document.getElementById("editCategoriaEstado").value;

  if (!id || !nombre) {
    if (toast) toast.error("Completa ID y Nombre");
    return;
  }

  const categoriaPayload = { id, nombre, icono, orden, estado };

  fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: API_KEY,
      action: "upsertCategoria",
      categoria: categoriaPayload
    })
  })
    .then(response => response.json())
    .then(data => {
      if (data.ok) {
        if (categoriaEnEdicion === null) {
          categoriasAdmin.push(categoriaPayload);
        } else {
          categoriasAdmin[categoriaEnEdicion] = categoriaPayload;
        }
        renderizarCategoriasAdmin();
        cerrarModalEditarCategoria();
        if (toast) toast.exito("Categoría guardada");
      } else {
        if (toast) toast.error(data.error || "Error al guardar categoría");
      }
    })
    .catch(error => {
      console.error("Error guardando categoría:", error);
      if (toast) toast.error("Error de conexión");
    });
}

function eliminarCategoria(index) {
  const cat = categoriasAdmin[index];
  if (!cat) return;

  if (!confirm("¿Deseas eliminar esta categoría?")) return;

  fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: API_KEY,
      action: "deleteCategoria",
      id: cat.id
    })
  })
    .then(response => response.json())
    .then(data => {
      if (data.ok) {
        categoriasAdmin.splice(index, 1);
        renderizarCategoriasAdmin();
        if (toast) toast.exito("Categoría eliminada");
      } else {
        if (toast) toast.error(data.error || "No se pudo eliminar");
      }
    })
    .catch(error => {
      console.error("Error eliminando categoría:", error);
      if (toast) toast.error("Error de conexión");
    });
}

function verCategoria(categoriaOrIndex) {
  if (typeof categoriaOrIndex === "number") {
    const cat = categoriasAdmin[categoriaOrIndex];
    if (!cat) return;
    if (typeof editarCategoria === "function") {
      editarCategoria(cat);
    } else if (typeof abrirEditarCategoria === "function") {
      abrirEditarCategoria(categoriaOrIndex);
    }
    return;
  }

  if (categoriaOrIndex && typeof categoriaOrIndex === "object") {
    if (typeof editarCategoria === "function") {
      editarCategoria(categoriaOrIndex);
    }
  }
}

function desactivarCategoria(categoriaOrIndex) {
  const cat = typeof categoriaOrIndex === "number"
    ? categoriasAdmin[categoriaOrIndex]
    : categoriaOrIndex;

  if (!cat) return;
  if (!confirm("¿Deseas desactivar esta categoría?")) return;

  const categoriaPayload = {
    id: cat.id,
    nombre: cat.nombre,
    icono: cat.icono || "",
    orden: cat.orden || 0,
    estado: "inactivo"
  };

  fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: API_KEY,
      action: "upsertCategoria",
      categoria: categoriaPayload
    })
  })
    .then(response => response.json())
    .then(data => {
      if (data.ok || data.success) {
        if (typeof categoriaOrIndex === "number" && categoriasAdmin[categoriaOrIndex]) {
          categoriasAdmin[categoriaOrIndex].estado = "inactivo";
        }
        if (typeof renderizarCategoriasAdmin === "function") {
          renderizarCategoriasAdmin();
        }
        if (typeof mostrarCategoriasAdmin === "function") {
          mostrarCategoriasAdmin(categoriasAdmin);
        }
        if (typeof cargarCategoriasAdmin === "function") {
          cargarCategoriasAdmin();
        }
        if (toast) toast.exito("Categoría desactivada");
      } else {
        if (toast) toast.error(data.error || data.mensaje || "No se pudo desactivar");
      }
    })
    .catch(error => {
      console.error("Error desactivando categoría:", error);
      if (toast) toast.error("Error de conexión");
    });
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORTAR DATOS
// ═══════════════════════════════════════════════════════════════════════

function formatearFechaContable(fechaValor) {
  const date = new Date(fechaValor);
  if (!isNaN(date.getTime())) {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yy = String(date.getFullYear()).slice(-2);
    return `${dd}${mm}${yy}`;
  }

  const raw = String(fechaValor || "").trim();
  const onlyDigits = raw.replace(/\D/g, "");
  if (onlyDigits.length >= 6) {
    return onlyDigits.slice(0, 6);
  }

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  return `${dd}${mm}${yy}`;
}

function limpiarCampoCSV(valor) {
  return String(valor ?? "").replace(/[\r\n;]+/g, " ").trim();
}

function normalizarFactura(facturaRaw) {
  const limpia = String(facturaRaw || "").replace(/\D/g, "");
  if (!limpia || limpia.length > 8) return "";
  return limpia.padStart(8, "0");
}

function pedirDatosExportacionCSV(pedido) {
  const pedidoId = pedido?.id_pedido ?? pedido?.pedido_id ?? pedido?.id ?? "";
  const cliente = String(pedido?.cliente || "").trim();
  const ultimoTipoUsado = String(localStorage.getItem("adminExportTipo") || "21").replace(/\D/g, "").slice(0, 2);

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(0,0,0,0.45)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "9999";

    const modal = document.createElement("div");
    modal.style.width = "min(92vw, 460px)";
    modal.style.background = "#ffffff";
    modal.style.borderRadius = "12px";
    modal.style.padding = "18px";
    modal.style.boxShadow = "0 14px 44px rgba(0,0,0,0.22)";

    modal.innerHTML = `
      <h3 style="margin:0 0 10px 0; font-size:18px;">Exportar CSV Contable</h3>
      <p style="margin:0 0 14px 0; color:#555; font-size:13px;">Pedido #${limpiarCampoCSV(pedidoId)} - ${limpiarCampoCSV(cliente || "N/A")}</p>

      <label for="exportFacturaInput" style="display:block; margin-bottom:6px; font-size:13px; font-weight:600;">Numero de factura</label>
      <input id="exportFacturaInput" type="text" placeholder="00002355" style="width:100%; box-sizing:border-box; padding:10px 11px; border:1px solid #d9d9d9; border-radius:8px; margin-bottom:12px;" />

      <label for="exportPrecioSelector" style="display:block; margin-bottom:6px; font-size:13px; font-weight:600;">Precio a usar</label>
      <select id="exportPrecioSelector" style="width:100%; box-sizing:border-box; padding:10px 11px; border:1px solid #d9d9d9; border-radius:8px; margin-bottom:14px;">
        <option value="precio1">Precio 1</option>
        <option value="precio2">Precio 2</option>
        <option value="precio3">Precio 3</option>
      </select>

      <label for="exportTipoInput" style="display:block; margin-bottom:6px; font-size:13px; font-weight:600;">Tipo (2 digitos)</label>
      <input id="exportTipoInput" type="text" maxlength="2" inputmode="numeric" placeholder="21" style="width:100%; box-sizing:border-box; padding:10px 11px; border:1px solid #d9d9d9; border-radius:8px; margin-bottom:14px;" />

      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button id="exportCancelarBtn" type="button" style="padding:9px 12px; border:1px solid #d0d0d0; background:#fff; border-radius:8px; cursor:pointer;">Cancelar</button>
        <button id="exportAceptarBtn" type="button" style="padding:9px 12px; border:none; background:#1f7a47; color:#fff; border-radius:8px; cursor:pointer;">Exportar</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const inputFactura = modal.querySelector("#exportFacturaInput");
    const selectPrecio = modal.querySelector("#exportPrecioSelector");
    const inputTipo = modal.querySelector("#exportTipoInput");
    const btnAceptar = modal.querySelector("#exportAceptarBtn");
    const btnCancelar = modal.querySelector("#exportCancelarBtn");

    inputTipo.value = /^\d{2}$/.test(ultimoTipoUsado) ? ultimoTipoUsado : "21";

    inputFactura.focus();

    const cerrar = (resultado) => {
      overlay.remove();
      resolve(resultado);
    };

    btnCancelar.addEventListener("click", () => cerrar(null));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) cerrar(null);
    });

    btnAceptar.addEventListener("click", () => {
      const factura = normalizarFactura(inputFactura.value);
      if (!factura || factura === "00000000") {
        alert("Debes ingresar una factura valida de maximo 8 digitos.");
        inputFactura.focus();
        return;
      }

      const tipo = String(inputTipo.value || "").replace(/\D/g, "");
      if (!/^\d{2}$/.test(tipo)) {
        alert("Debes ingresar un Tipo de exactamente 2 digitos.");
        inputTipo.focus();
        return;
      }

      localStorage.setItem("adminExportTipo", tipo);

      const precioSeleccionado = String(selectPrecio.value || "precio1");
      const etiquetas = { precio1: "Precio 1", precio2: "Precio 2", precio3: "Precio 3" };
      cerrar({
        factura,
        tipo,
        precioSeleccionado,
        precioEtiqueta: etiquetas[precioSeleccionado] || "Precio 1"
      });
    });
  });
}

function construirCSVContablePedido(pedido, items, datosContables) {
  const pedidoId = pedido.id_pedido ?? pedido.pedido_id ?? pedido.id ?? "";
  const fecha = formatearFechaContable(pedido.fecha);
  const tipo = String(datosContables.tipo || "21");
  const envio = `0${tipo}`;
  const factura = datosContables.factura;
  const precioSeleccionado = datosContables.precioSeleccionado || "precio1";
  const comentario = `ped.${pedidoId} ${limpiarCampoCSV(pedido.cliente || "")}`;

  const filas = [];

  const filaControl = Array(13).fill("");
  filaControl[12] = "1";
  filas.push(filaControl);

  let registro = 2;
  let totalCostoVenta = 0;
  let totalTransaccion = 0;

  items.forEach(item => {
    const cantidad = Number(item.cantidad || 0);
    const precio1 = Number(item.precio1 ?? item.precio_unitario ?? item.precio ?? 0);
    const precio2 = Number(item.precio2 ?? 0);
    const precio3 = Number(item.precio3 ?? 0);
    let precioVenta = precio1;
    if (precioSeleccionado === "precio2" && precio2 > 0) precioVenta = precio2;
    else if (precioSeleccionado === "precio3" && precio3 > 0) precioVenta = precio3;
    const totalVentaItem = cantidad * precioVenta;
    // Costo por item: precio de venta menos 30%.
    const costoVentaItem = totalVentaItem * 0.70;
    const codigoProducto = limpiarCampoCSV(item.contabilidad ?? item.codigo_contable ?? item.id_producto ?? item.id ?? item.codigo ?? "");
    const referencia = limpiarCampoCSV(item.referencia || "");
    const nombreBase = limpiarCampoCSV(item.producto || item.nombre || "Producto");
    const nombreProducto = referencia ? `${nombreBase} Ref:${referencia}` : nombreBase;

    totalTransaccion += totalVentaItem;
    totalCostoVenta += costoVentaItem;

    filas.push([
      codigoProducto,
      fecha,
      tipo,
      factura,
      "",
      envio,
      "",
      costoVentaItem.toFixed(2),
      nombreProducto,
      "4",
      cantidad ? String(cantidad) : "",
      precioVenta ? String(Math.round(precioVenta)) : "",
      String(registro)
    ]);

    registro += 1;
  });

  filas.push([
    "613595",
    fecha,
    tipo,
    factura,
    comentario,
    envio,
    totalCostoVenta.toFixed(2),
    "",
    "costo de venta",
    "",
    "",
    "",
    String(registro)
  ]);
  registro += 1;

  filas.push([
    "41359501",
    fecha,
    tipo,
    factura,
    comentario,
    envio,
    "",
    totalTransaccion.toFixed(2),
    "ingresos por venta",
    "",
    "",
    "",
    String(registro)
  ]);
  registro += 1;

  const facturaRem = String(Number(factura) || factura).slice(-5);
  filas.push([
    `130505100${facturaRem}`,
    fecha,
    tipo,
    factura,
    comentario,
    envio,
    totalTransaccion.toFixed(2),
    "",
    `rem. ${factura}`,
    "2",
    "",
    "",
    String(registro)
  ]);

  const body = filas
    .map(fila => fila.map(campo => limpiarCampoCSV(campo)).join(";"))
    .join("\n");

  return body;
}

async function exportarPedidoCSV(index) {
  const pedido = pedidosAdmin[index];
  if (!pedido) {
    if (window.toast) window.toast.error("Pedido no encontrado");
    return;
  }

  const datosContables = await pedirDatosExportacionCSV(pedido);
  if (!datosContables) {
    return;
  }

  const idPedido = pedido.id_pedido || pedido.pedido_id || pedido.id;
  const items = await obtenerDetallePedido(idPedido);

  if (!Array.isArray(items) || items.length === 0) {
    if (window.toast) window.toast.error("Este pedido no tiene items para exportar");
    return;
  }

  const contenidoCSV = construirCSVContablePedido(pedido, items, datosContables);
  const nombreArchivo = `${datosContables.factura}.csv`;
  descargarArchivo(contenidoCSV, nombreArchivo, "text/csv;charset=utf-8");

  try {
    await actualizarEstadoPedidoAdmin(idPedido, "procesando");
    await cargarPedidosAdmin();
    if (window.toast) window.toast.info(`Pedido #${idPedido} actualizado a procesando`);
  } catch (error) {
    console.error("Error actualizando estado del pedido tras exportar:", error);
    if (window.toast) window.toast.error(error.message || "No se pudo actualizar el estado del pedido");
  }
}

async function exportarPedidosCSV() {
  if (!Array.isArray(pedidosAdmin) || pedidosAdmin.length === 0) {
    if (window.toast) window.toast.error("No hay pedidos para exportar");
    return;
  }

  const opciones = pedidosAdmin
    .map((pedido, idx) => {
      const idPedido = pedido.id_pedido || pedido.pedido_id || pedido.id || `#${idx + 1}`;
      const cliente = limpiarCampoCSV(pedido.cliente || "N/A");
      return `${idPedido} (${cliente})`;
    })
    .join("\n");

  const idSeleccionado = window.prompt(
    `Selecciona el pedido a exportar escribiendo su ID:\n\n${opciones}`,
    String(pedidosAdmin[0].id_pedido || pedidosAdmin[0].pedido_id || pedidosAdmin[0].id || "")
  );

  if (idSeleccionado === null) {
    return;
  }

  const pedido = pedidosAdmin.find(p => {
    const idPedido = p.id_pedido || p.pedido_id || p.id;
    return String(idPedido) === String(idSeleccionado).trim();
  });

  if (!pedido) {
    if (window.toast) window.toast.error("No se encontró el pedido indicado");
    return;
  }

  const index = pedidosAdmin.indexOf(pedido);
  await exportarPedidoCSV(index);
}

function exportarPedidosJSON() {
  const json = JSON.stringify(pedidosAdmin, null, 2);
  descargarArchivo(json, "pedidos.json", "application/json");
}

function exportarProductosCSV() {
  let csv = "ID,Nombre,Categoría,Precio,Stock,Estado\n";
  productosAdmin.forEach((producto, index) => {
    csv += `${index + 1},"${producto.nombre}","${producto.categoria}",${producto.precio},${producto.stock || 0},"${producto.status || "activo"}"\n`;
  });

  descargarArchivo(csv, "productos.csv", "text/csv");
}

function exportarProductosJSON() {
  const json = JSON.stringify(productosAdmin, null, 2);
  descargarArchivo(json, "productos.json", "application/json");
}

function descargarArchivo(contenido, nombreArchivo, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nombreArchivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  if (toast) toast.exito(`${nombreArchivo} descargado`);
}

async function actualizarEstadoPedidoAdmin(idPedido, estado) {
  const response = await fetch(API_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "actualizarEstadoPedido",
      key: API_KEY,
      idPedido,
      estado
    })
  });

  const data = await response.json();
  if (!response.ok || !data || !data.ok) {
    throw new Error(data?.error || "No se pudo actualizar el estado del pedido");
  }

  return data;
}

// ═══════════════════════════════════════════════════════════════════════
// DATOS DE DEMO
// ═══════════════════════════════════════════════════════════════════════

function obtenerPedidosDemo() {
  return [
    {
      cliente: "Juan Pérez",
      ciudad: "Cali",
      telefono: "3215555555",
      fecha: "2026-01-25 14:30",
      estado: "entregado",
      total: 150000,
      items: [{ nombre: "Audífonos", cantidad: 1, precio: 150000 }],
      notas: "Entregado correctamente"
    },
    {
      cliente: "María García",
      ciudad: "Bogotá",
      telefono: "3105555555",
      fecha: "2026-01-26 10:15",
      estado: "procesando",
      total: 85000,
      items: [{ nombre: "Funda USB", cantidad: 1, precio: 85000 }],
      notas: ""
    }
  ];
}

function obtenerProductosDemo() {
  return [
    {
      id: 1,
      nombre: "Audífonos Inalámbricos",
      categoria: "sonido",
      precio: 150000,
      stock: 5,
      status: "activo",
      imagen: "https://via.placeholder.com/200?text=Audífonos"
    },
    {
      id: 2,
      nombre: "Funda USB",
      categoria: "accesorios",
      precio: 85000,
      stock: 15,
      status: "activo",
      imagen: "https://via.placeholder.com/200?text=USB"
    }
  ];
}

// ═══════════════════════════════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════════════════════════════

if (btnLogout) {
  btnLogout.addEventListener("click", cerrarSesion);
}

// ═══════════════════════════════════════════════════════════════════════
// GESTIÓN DE CATEGORÍAS
// ═══════════════════════════════════════════════════════════════════════

// Cargar categorías al ir al tab de categorías
document.addEventListener("click", (e) => {
  if (e.target.dataset.tab === "categorias") {
    cargarCategoriasAdmin();
  }
});

async function cargarCategoriasAdmin() {
  try {
    const listaCategorias = document.getElementById("listaCategoriasAdmin");
    const categoriasVacio = document.getElementById("categoriasVacio");
    
    listaCategorias.innerHTML = "<p style='text-align: center; padding: 20px;'>Cargando categorías...</p>";
    
    const res = await fetch(
      `${API_URL}?action=getCategorias&key=${API_KEY}`
    );
    
    if (!res.ok) {
      throw new Error("Error obteniendo categorías");
    }
    
    const data = await res.json();
    categoriasAdmin = data.items || [];
    
    if (categoriasAdmin.length === 0) {
      listaCategorias.innerHTML = "";
      categoriasVacio.style.display = "flex";
      return;
    }
    
    categoriasVacio.style.display = "none";
    mostrarCategoriasAdmin(categoriasAdmin);
    
  } catch (error) {
    console.error("Error cargando categorías:", error);
    const listaCategorias = document.getElementById("listaCategoriasAdmin");
    listaCategorias.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
  }
}

function mostrarCategoriasAdmin(categorias) {
  const listaCategorias = document.getElementById("listaCategoriasAdmin");
  listaCategorias.innerHTML = "";
  
  categorias
    .sort((a, b) => (a.orden || 0) - (b.orden || 0))
    .forEach(cat => {
      const card = document.createElement("div");
      card.className = "categoria-admin-card";
      card.innerHTML = `
        <div class="categoria-admin-content">
          <div class="categoria-admin-icon">
            <span class="material-symbols-outlined">${cat.icono || "shopping_bag"}</span>
          </div>
          <div class="categoria-admin-info">
            <h3>${cat.nombre}</h3>
            <p class="categoria-admin-icono">Icono: ${cat.icono || "N/A"}</p>
            <p class="categoria-admin-orden">Orden: ${cat.orden || 0}</p>
          </div>
        </div>
        <div class="categoria-admin-actions">
          <button onclick="editarCategoria(${JSON.stringify(cat).replace(/"/g, '&quot;')})" 
                  class="btn btn-small btn-outline">
            Editar
          </button>
        </div>
      `;
      listaCategorias.appendChild(card);
    });
}

function abrirFormCategoria() {
  categoriaEnEdicion = null;
  document.getElementById("modalCategoriaTitulo").textContent = "Nueva Categoría";
  document.getElementById("editCategoriaNombre").value = "";
  document.getElementById("editCategoriaIcono").value = "";
  document.getElementById("editCategoriaOrden").value = "0";
  document.getElementById("btnEliminarCategoria").style.display = "none";
  document.getElementById("modalEditarCategoria").style.display = "flex";
}

function editarCategoria(categoria) {
  categoriaEnEdicion = categoria;
  document.getElementById("modalCategoriaTitulo").textContent = "Editar Categoría";
  document.getElementById("editCategoriaNombre").value = categoria.nombre;
  document.getElementById("editCategoriaIcono").value = categoria.icono || "";
  document.getElementById("editCategoriaOrden").value = categoria.orden || 0;
  document.getElementById("btnEliminarCategoria").style.display = "inline-block";
  document.getElementById("modalEditarCategoria").style.display = "flex";
}

async function guardarCambioCategoria() {
  const nombre = document.getElementById("editCategoriaNombre").value.trim();
  const icono = document.getElementById("editCategoriaIcono").value.trim();
  const orden = parseInt(document.getElementById("editCategoriaOrden").value) || 0;
  
  if (!nombre) {
    alert("El nombre de la categoría es requerido");
    return;
  }
  
  if (!icono) {
    alert("El icono es requerido");
    return;
  }
  
  try {
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = "Guardando...";
    
    const payload = {
      action: categoriaEnEdicion ? "updateCategoria" : "createCategoria",
      key: API_KEY,
      nombre,
      icono,
      orden
    };
    
    if (categoriaEnEdicion) {
      payload.id = categoriaEnEdicion.id;
    }
    
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(payload)
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    
    const data = await res.json();
    
    if (data.success) {
      const msg = categoriaEnEdicion ? "Categoría actualizada" : "Categoría creada";
      toast.exito(msg);
      cerrarModalEditarCategoria();
      cache.categorias = null; // Invalidar cache
      cargarCategoriasAdmin();
    } else {
      throw new Error(data.mensaje || "Error al guardar");
    }
  } catch (error) {
    console.error("Error guardando categoría:", error);
    toast.error(`Error: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = categoriaEnEdicion ? "Guardar Cambios" : "Crear Categoría";
  }
}

async function eliminarCategoria() {
  if (!categoriaEnEdicion) return;
  
  if (!confirm("¿Estás seguro de que quieres eliminar esta categoría?")) {
    return;
  }
  
  try {
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = "Eliminando...";
    
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        action: "deleteCategoria",
        key: API_KEY,
        id: categoriaEnEdicion.id
      })
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    
    const data = await res.json();
    
    if (data.success) {
      toast.exito("Categoría eliminada");
      cerrarModalEditarCategoria();
      cache.categorias = null; // Invalidar cache
      cargarCategoriasAdmin();
    } else {
      throw new Error(data.mensaje || "Error al eliminar");
    }
  } catch (error) {
    console.error("Error eliminando categoría:", error);
    toast.error(`Error: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "Eliminar";
  }
}

function cerrarModalEditarCategoria() {
  document.getElementById("modalEditarCategoria").style.display = "none";
  categoriaEnEdicion = null;
}

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN - CORREO BODEGA
// ═══════════════════════════════════════════════════════════════════════

async function guardarCorreoBodega() {
  const correoBodega = document.getElementById("correoBodega").value.trim();

  if (!correoBodega) {
    alert("Por favor ingresa un correo válido");
    return;
  }

  // Validar formato de correo
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(correoBodega)) {
    alert("Por favor ingresa un correo válido");
    return;
  }

  try {
    const response = await fetch(API_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "guardarConfiguracion",
        key: API_KEY,
        config: {
          correo_bodega: correoBodega
        }
      })
    });

    const data = await response.json();

    if (data.success) {
      alert("✓ Correo de bodega guardado correctamente");
    } else {
      alert("Error al guardar: " + (data.error || "Desconocido"));
    }
  } catch (error) {
    console.error("Error guardando correo de bodega:", error);
    alert("Error de conexión. No se pudo guardar el correo.");
  }
}

async function cargarCorreoBodega() {
  const correoInput = document.getElementById("correoBodega");
  if (!correoInput) return;

  try {
    let data = null;
    try {
      const response = await fetch(API_PROXY_URL + "?action=obtenerConfiguracion&key=" + API_KEY);
      data = await response.json();
    } catch (proxyError) {
      console.warn("Proxy no disponible, usando endpoint directo:", proxyError);
    }

    if (!data || !data.success || !data.correo_bodega) {
      const responseDirect = await fetch(API_URL + "?action=obtenerConfiguracion&key=" + API_KEY);
      data = await responseDirect.json();
    }

    if (data && data.success && data.correo_bodega) {
      correoInput.value = data.correo_bodega;
    }
  } catch (error) {
    console.warn("No se pudo cargar configuración desde servidor:", error);
  }
}

async function generarUrlsImagenes(event) {
  console.log("🚀 Iniciando generarUrlsImagenes", event);
  const btn = event?.target || document.querySelector("button[onclick*='generarUrlsImagenes']");
  const statusDiv = document.getElementById("urlGenerationStatus");
  
  if (!confirm("¿Estás seguro de que deseas regenerar las URLs de todas las imágenes? Esto actualizará la columna 'Url_Imagen_Drive' en la hoja de productos.")) {
    console.log("❌ Usuario canceló la operación");
    return;
  }
  
  console.log("✅ Confirmación recibida, procediendo con la generación...");

  btn.disabled = true;
  btn.textContent = "🔄 Generando URLs...";
  
  if (statusDiv) {
    statusDiv.style.display = "block";
    statusDiv.style.background = "#e3f2fd";
    statusDiv.style.color = "#1976d2";
    statusDiv.innerHTML = "⏳ Procesando imágenes...";
  }

  try {
    console.log("📡 Enviando petición al servidor...", { API_PROXY_URL, action: "generarUrlsImagenes" });
    const response = await fetch(API_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "generarUrlsImagenes",
        key: API_KEY
      })
    });

    const data = await response.json();
    console.log("📦 Respuesta recibida del servidor:", data);

    if (data.success) {
      if (statusDiv) {
        statusDiv.style.background = "#d4edda";
        statusDiv.style.color = "#155724";
        statusDiv.innerHTML = `
          ✅ <strong>URLs generadas exitosamente</strong><br>
          📊 ${data.actualizados} imágenes actualizadas<br>
          ⚠️ ${data.noEncontrados} referencias no encontradas
        `;
      }
      alert(`✓ ${data.message}`);
    } else {
      throw new Error(data.error || "Error desconocido");
    }
  } catch (error) {
    console.error("Error generando URLs:", error);
    if (statusDiv) {
      statusDiv.style.background = "#f8d7da";
      statusDiv.style.color = "#721c24";
      statusDiv.innerHTML = `❌ Error: ${error.message}`;
    }
    alert("Error al generar URLs: " + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "🔗 Generar URLs de Imágenes";
  }
}

async function probarCorreoBodega(event) {
  const correoBodega = document.getElementById("correoBodega").value.trim();

  if (!correoBodega) {
    alert("Por favor ingresa un correo de bodega primero");
    return;
  }

  const btn = event?.target || document.querySelector("button[onclick*='probarCorreoBodega']");
  btn.disabled = true;
  btn.textContent = "📧 Enviando prueba...";

  try {
    // Crear un pedido de prueba
    const pedidoPrueba = {
      pedido_id: "TEST-" + Date.now(),
      cliente: {
        nombre: "Prueba Admin",
        ciudad: "Test",
        telefono: "0000000000",
        notas: "Este es un correo de prueba"
      },
      items: [
        {
          nombre: "Producto de Prueba",
          categoria: "Test",
          cantidad: 1,
          precio: 0
        }
      ]
    };

    const response = await fetch(API_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "enviarNotificacionBodega",
        key: API_KEY,
        pedido_id: pedidoPrueba.pedido_id,
        cliente: pedidoPrueba.cliente,
        items: pedidoPrueba.items
      })
    });

    const data = await response.json();

    if (data.success) {
      alert("✓ Correo de prueba enviado a: " + correoBodega);
    } else if (data.warning) {
      alert("⚠ Advertencia: " + data.warning + "\n\nSi aún no has configurado el correo en Google Apps Script, hazlo en el spreadsheet.");
    } else {
      alert("Error al enviar: " + (data.error || "Desconocido"));
    }
  } catch (error) {
    console.error("Error enviando correo de prueba:", error);
    alert("Error de conexión al enviar prueba");
  } finally {
    btn.disabled = false;
    btn.textContent = "📧 Enviar Prueba";
  }
}

// ═══════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════════════

window.addEventListener("load", () => {
  window.guardarCorreoBodega = guardarCorreoBodega;
  window.probarCorreoBodega = probarCorreoBodega;
  window.cargarCorreoBodega = cargarCorreoBodega;
  window.generarUrlsImagenes = generarUrlsImagenes;
  verificarAutenticacion();
  // Cargar configuración cuando se carga la página
  if (document.getElementById("correoBodega")) {
    cargarCorreoBodega();
  }

  const btnGenerar = document.getElementById("btnGenerarUrlsImagenes");
  if (btnGenerar) {
    console.log("✅ Vinculando evento al botón de generación de URLs");
    btnGenerar.addEventListener("click", (event) => {
      console.log("🔗 Botón clickeado, ejecutando generarUrlsImagenes");
      generarUrlsImagenes(event);
    });
  } else {
    console.warn("⚠️ No se encontró el botón btnGenerarUrlsImagenes");
  }
});

}); // Cerrar DOMContentLoaded
