/* ═══════════════════════════════════════════════════════════════════════
   ADMIN.JS - PANEL DE ADMINISTRACIÓN
   ═══════════════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN GLOBAL PARA ADMIN
// ═══════════════════════════════════════════════════════════════════════

const API_URL = "https://script.google.com/macros/s/AKfycbw_QrC9F3DBGzwNFRjby2wa6iFNuGDUTkIQHBWi4VVpwolR6KhF7OlCyPYBzqhDoekoyA/exec";
const API_KEY = "TIENDA_API_2026";

// ═══════════════════════════════════════════════════════════════════════
// AUTENTICACIÓN GLOBAL (PARA EVITAR ERRORES DE TIMING)
// ═══════════════════════════════════════════════════════════════════════

function autenticar(event) {
  event.preventDefault();

  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value;

  // Credenciales demo (hardcodeadas para evitar problemas de timing)
  const usuarios = [
    { username: "admin@tienda.com", password: "admin123", rol: "admin" },
    { username: "gerente@tienda.com", password: "gerente123", rol: "gerente" }
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

// ═══════════════════════════════════════════════════════════════════════
// CARGAR PEDIDOS
// ═══════════════════════════════════════════════════════════════════════

function cargarPedidosAdmin() {
  // Simular carga desde Google Sheets
  fetch(API_URL + "?action=obtenerPedidos&apiKey=" + API_KEY)
    .then(response => response.json())
    .then(data => {
      if (data.success && data.pedidos) {
        pedidosAdmin = data.pedidos;
        renderizarPedidosAdmin();
      }
    })
    .catch(error => {
      console.error("Error al cargar pedidos:", error);
      // Usar datos de ejemplo en caso de error
      pedidosAdmin = obtenerPedidosDemo();
      renderizarPedidosAdmin();
    });
}

function renderizarPedidosAdmin() {
  const listaPedidos = document.getElementById("listaPedidos");
  const pedidosVacio = document.getElementById("pedidosVacio");

  if (!pedidosAdmin || pedidosAdmin.length === 0) {
    listaPedidos.style.display = "none";
    pedidosVacio.style.display = "flex";
    return;
  }

  listaPedidos.style.display = "grid";
  pedidosVacio.style.display = "none";
  listaPedidos.innerHTML = "";

  pedidosAdmin.forEach((pedido, index) => {
    const pedidoDiv = document.createElement("div");
    pedidoDiv.className = `pedido-card estado-${pedido.estado || 'pendiente'}`;

    const totalItems = pedido.items ? pedido.items.reduce((sum, item) => sum + (item.cantidad || 1), 0) : 0;

    pedidoDiv.innerHTML = `
      <div class="pedido-header">
        <div class="pedido-info">
          <h3>#${index + 1} - ${pedido.cliente}</h3>
          <p class="pedido-fecha">${pedido.fecha || new Date().toLocaleString("es-CO")}</p>
        </div>
        <span class="pedido-estado ${pedido.estado || 'pendiente'}">
          ${pedido.estado || 'pendiente'}
        </span>
      </div>

      <div class="pedido-body">
        <p><strong>Ciudad:</strong> ${pedido.ciudad}</p>
        <p><strong>Teléfono:</strong> ${pedido.telefono || "N/A"}</p>
        <p><strong>Items:</strong> ${totalItems}</p>
        <p><strong>Total:</strong> $ ${Number(pedido.total || 0).toLocaleString()}</p>
      </div>

      <div class="pedido-acciones">
        <button onclick="abrirEditarPedido(${index})" class="btn btn-small">
          ✎ Editar
        </button>
        <button onclick="imprimirPedido(${index})" class="btn btn-small">
          🖨 Imprimir
        </button>
        <button onclick="eliminarPedido(${index})" class="btn btn-small btn-danger">
          🗑 Eliminar
        </button>
      </div>
    `;

    listaPedidos.appendChild(pedidoDiv);
  });
}

function refrescarPedidos() {
  cargarPedidosAdmin();
  if (toast) toast.info("Pedidos actualizados");
}

// ═══════════════════════════════════════════════════════════════════════
// EDITAR PEDIDO
// ═══════════════════════════════════════════════════════════════════════

function abrirEditarPedido(index) {
  pedidoEnEdicion = index;
  const pedido = pedidosAdmin[index];

  document.getElementById("pedidoId").textContent = index + 1;
  document.getElementById("pedidoCliente").textContent = pedido.cliente;
  document.getElementById("pedidoFecha").textContent = pedido.fecha || "N/A";
  document.getElementById("pedidoTotal").textContent = `$ ${Number(pedido.total || 0).toLocaleString()}`;
  document.getElementById("selectEstado").value = pedido.estado || "pendiente";
  document.getElementById("notasPedido").value = pedido.notas || "";

  document.getElementById("modalEditarPedido").style.display = "flex";
}

function cerrarModalEditarPedido() {
  document.getElementById("modalEditarPedido").style.display = "none";
  pedidoEnEdicion = null;
}

function guardarCambioPedido() {
  if (pedidoEnEdicion === null) return;

  const nuevoEstado = document.getElementById("selectEstado").value;
  const nuevasNotas = document.getElementById("notasPedido").value;

  pedidosAdmin[pedidoEnEdicion].estado = nuevoEstado;
  pedidosAdmin[pedidoEnEdicion].notas = nuevasNotas;

  // Sincronizar con API
  fetch(API_URL, {
    method: "POST",
    body: new URLSearchParams({
      action: "actualizarPedido",
      apiKey: API_KEY,
      pedidoIndex: pedidoEnEdicion,
      pedidoData: JSON.stringify(pedidosAdmin[pedidoEnEdicion])
    })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        if (toast) toast.exito("Pedido actualizado");
        cerrarModalEditarPedido();
        renderizarPedidosAdmin();
      } else {
        if (toast) toast.error("Error al guardar cambios");
      }
    })
    .catch(error => {
      console.error("Error:", error);
      if (toast) toast.error("Error de conexión");
    });
}

function imprimirPedido(index) {
  const pedido = pedidosAdmin[index];
  const contenido = `
    <h2>PEDIDO #${index + 1}</h2>
    <p><strong>Cliente:</strong> ${pedido.cliente}</p>
    <p><strong>Ciudad:</strong> ${pedido.ciudad}</p>
    <p><strong>Teléfono:</strong> ${pedido.telefono || "N/A"}</p>
    <p><strong>Fecha:</strong> ${pedido.fecha || "N/A"}</p>
    <p><strong>Estado:</strong> ${pedido.estado || "pendiente"}</p>
    
    <h3>Items:</h3>
    <table border="1" cellpadding="5">
      <tr>
        <th>Producto</th>
        <th>Cantidad</th>
        <th>Precio</th>
        <th>Subtotal</th>
      </tr>
      ${(pedido.items || []).map(item => `
        <tr>
          <td>${item.nombre}</td>
          <td>${item.cantidad}</td>
          <td>$ ${Number(item.precio).toLocaleString()}</td>
          <td>$ ${Number(item.precio * item.cantidad).toLocaleString()}</td>
        </tr>
      `).join("")}
    </table>
    
    <p><strong>Total:</strong> $ ${Number(pedido.total || 0).toLocaleString()}</p>
    ${pedido.notas ? `<p><strong>Notas:</strong> ${pedido.notas}</p>` : ""}
  `;

  const ventana = window.open("", "Imprimir Pedido", "width=800,height=600");
  ventana.document.write(`
    <html>
      <head>
        <title>Pedido #${index + 1}</title>
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

// ═══════════════════════════════════════════════════════════════════════
// EXPORTAR DATOS
// ═══════════════════════════════════════════════════════════════════════

function exportarPedidosCSV() {
  let csv = "ID,Cliente,Ciudad,Teléfono,Fecha,Estado,Total\n";
  pedidosAdmin.forEach((pedido, index) => {
    csv += `${index + 1},"${pedido.cliente}","${pedido.ciudad}","${pedido.telefono || "N/A"}","${pedido.fecha || ""}","${pedido.estado || "pendiente"}",${pedido.total || 0}\n`;
  });

  descargarArchivo(csv, "pedidos.csv", "text/csv");
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
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════════════

window.addEventListener("load", () => {
  verificarAutenticacion();
});

}); // Cerrar DOMContentLoaded
