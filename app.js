const API_URL = "https://script.google.com/macros/s/AKfycbzrRc0e5xD9tLPFPsQNgGdfGaHTkJ5uuCLW_ZGZad0I68MBQKtm11yQNkZNOjxFL8SuhQ/exec";
const API_KEY = "TIENDA_API_2026";
const CLOUDFLARE_PROXY = "https://tienda-image-proxy.pedidosnia-cali.workers.dev";
// buena con cors version 6.1
const LIMIT = 20;

let page = 0;
let categoria = "";

const productosDiv = document.getElementById("productos");
const categoriaFiltro = document.getElementById("categoriaFiltro");
const pageInfo = document.getElementById("pageInfo");

const cache = {
  productos: null,
  timestamp: 0,
  ttl: 10 * 60 * 1000 // 10 minutos
};

// 🔥 FETCH CON CACHE FRONTEND
async function fetchProductos() {
  if (cache.productos && Date.now() - cache.timestamp < cache.ttl) {
    return cache.productos;
  }

  const res = await fetch(
    `${API_URL}?action=getProductos&offset=0&limit=3000&key=${API_KEY}`
  );
  const data = await res.json();

  cache.productos = data.items;
  cache.timestamp = Date.now();

  return data.items;
}

// 🔹 CONVERTIR URL DE DRIVE A PROXY CLOUDFLARE
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

// 🔹 GENERAR SVG FALLBACK COLORIDO
function generarFallbackSVG(nombre, id) {
  const inicial = nombre ? nombre.charAt(0).toUpperCase() : '?';
  const colores = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
  const color = colores[id % colores.length];
  
  return `data:image/svg+xml;base64,${btoa(`
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="300" fill="${color}"/>
      <text x="200" y="160" font-size="120" fill="white" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold">${inicial}</text>
    </svg>
  `)}`;
}

// 🔹 CARGAR IMAGEN DIRECTAMENTE (Sin precarga para evitar SameSite issues)
function cargarImagenDirecta(img, src, fallback) {
  // Asignar directamente al src
  img.src = src;
  
  // Si falla, usar fallback
  img.onerror = () => {
    if (img.src !== fallback) {
      img.src = fallback;
    }
  };
}

// 🔹 RENDER
function render(productos) {
  productosDiv.innerHTML = "";

  productos.forEach(p => {
    // Convertir URL de Drive a Proxy de Cloudflare
    const proxyUrl = convertirDriveUrlAProxy(p.imagen);
    const fallbackSVG = generarFallbackSVG(p.nombre, p.id);
    
    console.log("Producto:", p.nombre);
    console.log("Original:", p.imagen);
    console.log("Proxy:", proxyUrl);
    
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <img
        src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCI+PC9zdmc+"
        data-src="${proxyUrl || p.imagen}"
        data-fallback="${fallbackSVG}"
        loading="lazy"
        alt="${p.nombre}"
      >
      <div class="info">
        <h3>${p.nombre}</h3>
        <div class="precio">$ ${p.precio}</div>

        <div class="qty-card">
          <button onclick="cambiarCantidadCard(${p.id}, -1)">−</button>
          <input
            type="number"
            min="1"
            value="1"
            id="qty-${p.id}"
          >
          <button onclick="cambiarCantidadCard(${p.id}, 1)">+</button>
        </div>

        <button class="btn"
          onclick='agregarAlCarrito(${JSON.stringify(p)}, document.getElementById("qty-${p.id}").value)'>
          Agregar
        </button>
      </div>
    `;

    productosDiv.appendChild(card);
  });

  activarLazyLoading();
}

// 🔹 LAZY LOADING CON CARGA DIRECTA
function activarLazyLoading() {
  const imgs = document.querySelectorAll("img[data-src]");

  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const img = e.target;
        const src = img.dataset.src;
        const fallback = img.dataset.fallback;
        
        // Cargar directamente sin precarga
        cargarImagenDirecta(img, src, fallback);
        
        img.removeAttribute("data-src");
        obs.unobserve(img);
      }
    });
  }, { rootMargin: "100px" });

  imgs.forEach(i => obs.observe(i));
}

// 🔹 PAGINACIÓN + FILTRO
async function cargar() {
  const all = await fetchProductos();

  const filtrados = categoria
    ? all.filter(p => p.categoria === categoria)
    : all;

  const start = page * LIMIT;
  const items = filtrados.slice(start, start + LIMIT);

  pageInfo.textContent = `Página ${page + 1} / ${Math.ceil(filtrados.length / LIMIT)}`;
  render(items);

  document.getElementById("prev").disabled = page === 0;
  document.getElementById("next").disabled = start + LIMIT >= filtrados.length;
}

// 🔹 EVENTOS
document.getElementById("prev").onclick = () => {
  page--;
  cargar();
};

document.getElementById("next").onclick = () => {
  page++;
  cargar();
};

categoriaFiltro.onchange = e => {
  categoria = e.target.value;
  page = 0;
  cargar();
};

// 🔹 INIT
(async () => {
  const productos = await fetchProductos();

  const categorias = [...new Set(productos.map(p => p.categoria))];
  categorias.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    categoriaFiltro.appendChild(opt);
  });

  cargar();
})();


let carrito = JSON.parse(localStorage.getItem("carrito")) || [];

function guardarCarrito() {
  localStorage.setItem("carrito", JSON.stringify(carrito));
  renderCarrito();
}



function agregarAlCarrito(producto, cantidad) {
  cantidad = Number(cantidad);
  if (cantidad <= 0) return;

  const item = carrito.find(p => p.id === producto.id);

  if (item) {
    item.cantidad += cantidad;
  } else {
    carrito.push({
      id: producto.id,
      nombre: producto.nombre,
      precio: producto.precio,
      cantidad: cantidad
    });
  }

  guardarCarrito();
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

  cont.innerHTML = "";
  let total = 0;

  carrito.forEach(p => {
    total += p.precio * p.cantidad;

    cont.innerHTML += `
      <div class="item">
        <span>${p.nombre}</span>
        <div class="qty">
          <button onclick="cambiarCantidad(${p.id}, -1)">-</button>
          <span>${p.cantidad}</span>
          <button onclick="cambiarCantidad(${p.id}, 1)">+</button>
        </div>
      </div>
    `;
  });

  totalDiv.textContent = `$ ${total.toLocaleString()}`;
}



function cambiarCantidad(id, delta) {
  const item = carrito.find(p => p.id === id);
  if (!item) return;

  item.cantidad += delta;

  if (item.cantidad <= 0) {
    carrito = carrito.filter(p => p.id !== id);
  }

  guardarCarrito();
}





//post envios pedidos
async function enviarPedido() {
  if (!carrito.length) {
    alert("El carrito está vacío");
    return;
  }

  const nombre = document.getElementById("clienteNombre").value;
  const ciudad = document.getElementById("clienteCiudad").value;

  if (!nombre || !ciudad) {
    alert("Nombre y ciudad son obligatorios");
    return;
  }

  const total = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);

const res = await fetch("https://pedido-proxy.pedidosnia-cali.workers.dev", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "crearPedido",
    key: API_KEY,
    cliente: { nombre, ciudad },
    items: carrito,
    total
  })
});


  const data = await res.json();

if (data.success) {
  alert(`Pedido enviado correctamente\nID: ${data.pedido_id}`);
  carrito = [];
  guardarCarrito();
	} else {
    alert("Error al enviar pedido");
  }
}
