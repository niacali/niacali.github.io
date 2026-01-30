/*********************************
 * CONFIGURACIÓN GENERAL
 *********************************/
const API_KEY = "TIENDA_API_2026";
const SPREADSHEET_ID = "1MEhAYz3r3xy70LhlWEjO8QdB9y0C1LMrDTQgutiT5RA";
const CLOUDFLARE_IMAGE_PROXY = "https://tienda-image-proxy.pedidosnia-cali.workers.dev";
const DRIVE_IMAGES_FOLDER_ID = "1EDyKQ1ISi1UyieKQ01JgywP-whGF5A9U";

const SHEET_PRODUCTOS = "Productos";
const SHEET_CATEGORIAS = "Categorias";
const SHEET_PEDIDOS = "Pedidos";
const CACHE_MINUTES = 10;

/*********************************
 * ENTRADAS PRINCIPALES
 *********************************/
function doGet(e) {
  try {
    // Manejo de proxy de imágenes
    if (e.parameter.imageId) {
      return servirImagen(e.parameter.imageId);
    }

    validarKey(e);

    const action = e.parameter.action;
    if (!action) throw "Acción no especificada";

    switch (action) {
      case "getCategorias":
        return jsonOutput(getCategorias());

      case "getProductos":
        return jsonOutput(getProductos(e.parameter));

      case "getProducto":
        return jsonOutput(getProducto(e.parameter.id));

      default:
        throw "Acción GET no válida";
    }
  } catch (err) {
    return errorOutput(err);
  }
}

function doOptions() {
  return ContentService
    .createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type");
}


function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) {
      throw new Error("No postData recibido");
    }

    const data = JSON.parse(e.postData.contents);

    if (data.key !== API_KEY) {
      throw new Error("API KEY inválida");
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName("pedidos");

    sheet.appendRow([
      new Date(),
      data.cliente.nombre,
      data.cliente.ciudad,
      data.total,
      JSON.stringify(data.items)
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: false,
        error: err.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}




/*********************************
 * VALIDACIONES
 *********************************/
function validarKey(e) {
  if (e.parameter.key !== API_KEY) {
    throw "API KEY inválida";
  }
}

/*********************************
 * ACCESO CENTRALIZADO AL SHEET
 *********************************/
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/*********************************
 * CATEGORÍAS
 *********************************/
function getCategorias() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_CATEGORIAS);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  return data
    .filter(r => r[headers.indexOf("estado")] === "activo")
    .map(r => ({
      id: r[headers.indexOf("id")],
      nombre: r[headers.indexOf("nombre")]
    }));
}

/*********************************
 * PRODUCTOS (CACHE + PAGINACIÓN)
 *********************************/
function getProductos(params) {
  const offset = Number(params.offset || 0);
  const limit = Number(params.limit || 20);
  const categoria = params.categoria || "";

  let productos;

  if (categoria) {
    productos = cargarProductosPorCategoria(categoria);
  } else {
    productos = cargarProductos();
  }

  return {
    total: productos.length,
    items: productos.slice(offset, offset + limit)
  };
}

function cargarProductos() {
  const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_PRODUCTOS);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  return data.map(r => ({
    id: r[headers.indexOf("id")],
    nombre: r[headers.indexOf("nombre")],
    precio: r[headers.indexOf("precio")],
    categoria: r[headers.indexOf("categoria")],
    imagen: convertirDriveUrl(r[headers.indexOf("Url_Imagen_Drive")]),
    descripcion: r[headers.indexOf("descripcion")],
    estado: r[headers.indexOf("estado")],
    referencia: r[headers.indexOf("referencia")]
  }));
}


function cargarProductosPorCategoria(categoria) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PRODUCTOS);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  const idxEstado = headers.indexOf("estado");
  const idxCategoria = headers.indexOf("categoria");

  const idxId = headers.indexOf("id");
  const idxNombre = headers.indexOf("nombre");
  const idxPrecio = headers.indexOf("precio");
  const idxImagen = headers.indexOf("Url_Imagen_Drive");
  const idxReferencia = headers.indexOf("referencia");

  const catParam = String(categoria || "").toLowerCase().trim();

  const items = data
    .filter(r => {
      const estado = String(r[idxEstado] || "").toLowerCase().trim();
      const cat = String(r[idxCategoria] || "").toLowerCase().trim();

      const estadoOk = estado === "disponible";
      const categoriaOk = !catParam || cat === catParam;

      return estadoOk && categoriaOk;
    })
    .map(r => ({
      id: r[idxId],
      nombre: r[idxNombre],
      precio: r[idxPrecio],
      categoria: r[idxCategoria],
      referencia: r[idxReferencia],
      imagen: convertirDriveUrl(r[idxImagen])
    }));

  return items;
}



/*********************************
 * PRODUCTO INDIVIDUAL
 *********************************/
function getProducto(id) {
  if (!id) throw "ID requerido";

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PRODUCTOS);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  const idxId = headers.indexOf("id");

  const row = data.find(r => String(r[idxId]) == String(id));
  if (!row) throw "Producto no encontrado";

  return {
    id: row[headers.indexOf("id")],
    nombre: row[headers.indexOf("nombre")],
    precio: row[headers.indexOf("precio")],
    categoria: row[headers.indexOf("categoria")],
    imagen: convertirDriveUrl(row[headers.indexOf("Url_Imagen_Drive")]),
    descripcion: row[headers.indexOf("descripcion")],
    estado: row[headers.indexOf("estado")],
    referencia: row[headers.indexOf("referencia")]
  };
}

/*********************************
 * CREAR PEDIDO
 *********************************/
function crearPedido(data) {
  if (!data.cliente || !data.ciudad || !Array.isArray(data.items)) {
    throw "Datos de pedido incompletos";
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PEDIDOS);
  const pedidoId = generarIdPedido();

  sheet.appendRow([
    pedidoId,
    new Date(),
    data.cliente,
    data.ciudad,
    JSON.stringify(data.items),
    data.total || 0,
    "nuevo"
  ]);

  return {
    success: true,
    pedido_id: pedidoId
  };
}

function generarIdPedido() {
  return "PED-" + Utilities.formatDate(
    new Date(),
    "GMT-5",
    "yyyyMMdd-HHmmss"
  );
}

/*********************************
 * UTILIDADES
 *********************************/
function convertirDriveUrl(url) {
  if (!url) return "";

  const fileId = extraerFileId(url);
  if (fileId) {
    return construirProxyUrl(fileId);
  }

  return url;
}

function construirProxyUrl(fileId) {
  return `${CLOUDFLARE_IMAGE_PROXY}/?fileId=${fileId}&key=${API_KEY}`;
}

function extraerFileId(value) {
  if (!value) return "";
  const match = String(value).match(/[-\w]{25,}/);
  return match && match[0] ? match[0] : "";
}

function servirImagen(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    
    return ContentService
      .createOutput()
      .append(blob.getDataAsString())
      .setMimeType(blob.getContentType())
      .setHeader("Access-Control-Allow-Origin", "*")
      .setHeader("Cache-Control", "public, max-age=86400");
  } catch (err) {
    // Si falla, redirigir al formato directo de Drive
    const redirectUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
    return HtmlService.createHtmlOutput(
      `<script>window.location.href="${redirectUrl}"</script>`
    );
  }
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type");
}


function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorOutput(err) {
  return ContentService
    .createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    if (body.key !== API_KEY) throw "API KEY inválida";

    if (body.action === "crearPedido") {
      return json(crearPedido(body));
    }

    throw "Acción no válida";

  } catch (err) {
    return json({ success: false, error: err });
  }
}

function generarPedidoId(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return `PED-${Utilities.formatDate(new Date(), "GMT-5", "yyyyMMdd")}-0001`;
  }

  const lastId = sheet.getRange(lastRow, 1).getValue();
  const num = Number(lastId.split("-").pop()) + 1;

  return `PED-${Utilities.formatDate(new Date(), "GMT-5", "yyyyMMdd")}-${String(num).padStart(4, "0")}`;
}



function crearPedido(data) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName("pedidos");

  const pedidoId = generarPedidoId(sheet);

  const total = data.items.reduce(
    (sum, p) => sum + p.precio * p.cantidad,
    0
  );

  sheet.appendRow([
    pedidoId,
    new Date(),
    data.cliente.nombre,
    data.cliente.ciudad,
    total,
    JSON.stringify(data.items)
  ]);

  return {
    success: true,
    pedido_id: pedidoId
  };
}

/*********************************
 * PRUEBA COMPLETA DEL SISTEMA
 *********************************/
function probarSistema() {
  const resultados = {
    ok: true,
    apiKey: { ok: true },
    categorias: { ok: true, total: 0 },
    productos: { ok: true, total: 0 },
    imagenes: { ok: true }
  };

  try {
    validarKey({ parameter: { key: API_KEY } });
  } catch (err) {
    resultados.ok = false;
    resultados.apiKey = { ok: false, error: String(err) };
  }

  try {
    validarKey({ parameter: { key: "INVALIDA" } });
    resultados.ok = false;
    resultados.apiKey.invalid = { ok: false, error: "No falló con key inválida" };
  } catch (err) {
    resultados.apiKey.invalid = { ok: true };
  }

  try {
    const categorias = getCategorias();
    resultados.categorias.total = categorias.length;
    resultados.categorias.muestra = categorias.slice(0, 3);
    if (!categorias.length) {
      resultados.ok = false;
      resultados.categorias.ok = false;
      resultados.categorias.error = "Sin categorías activas";
    }
  } catch (err) {
    resultados.ok = false;
    resultados.categorias = { ok: false, error: String(err) };
  }

  let productoMuestra = null;
  try {
    const productos = getProductos({ offset: 0, limit: 5, categoria: "" });
    resultados.productos.total = productos.total || productos.items.length;
    resultados.productos.muestra = productos.items.slice(0, 3);
    productoMuestra = productos.items[0] || null;
    if (!productos.items.length) {
      resultados.ok = false;
      resultados.productos.ok = false;
      resultados.productos.error = "Sin productos";
    }
  } catch (err) {
    resultados.ok = false;
    resultados.productos = { ok: false, error: String(err) };
  }

  try {
    if (!productoMuestra || !productoMuestra.imagen) {
      resultados.ok = false;
      resultados.imagenes = { ok: false, error: "Producto sin imagen para prueba" };
    } else {
      const urlImagen = convertirDriveUrl(productoMuestra.imagen);
      const response = UrlFetchApp.fetch(urlImagen, {
        method: "get",
        muteHttpExceptions: true
      });
      const status = response.getResponseCode();
      resultados.imagenes = {
        ok: status === 200,
        status,
        url: urlImagen,
        contentType: response.getHeaders()["Content-Type"] || ""
      };
      if (status !== 200) {
        resultados.ok = false;
      }
    }
  } catch (err) {
    resultados.ok = false;
    resultados.imagenes = { ok: false, error: String(err) };
  }

  return resultados;
}
