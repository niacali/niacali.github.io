/*********************************
 * CONFIGURACIÓN GENERAL
 *********************************/
const API_KEY = "TIENDA_API_2026";
const SPREADSHEET_ID = "1MEhAYz3r3xy70LhlWEjO8QdB9y0C1LMrDTQgutiT5RA";
const CLOUDFLARE_IMAGE_PROXY = "https://tienda-image-proxy.pedidosnia-cali.workers.dev";
const DRIVE_IMAGES_FOLDER_ID = "1EDyKQ1ISi1UyieKQ01JgywP-whGF5A9U";

const SHEET_PRODUCTOS = "Productos";
const SHEET_CATEGORIAS = "categorias";
const SHEET_PEDIDOS = "Pedidos";
const SHEET_CONFIG = "Config";
const CACHE_MINUTES = 10;

/*********************************
 * ENTRADAS PRINCIPALES
 *********************************/
function doGet(e) {
  try {
    Logger.log("doGet llamado con parámetros: " + JSON.stringify(e.parameter));

    // Manejo de proxy de imágenes
    if (e.parameter.imageId) {
      return servirImagen(e.parameter.imageId);
    }

    validarKey(e);

    const action = e.parameter.action;
    if (!action) throw "Acción no especificada";

    Logger.log("Procesando acción: " + action);

    switch (action) {
      case "getCategorias":
        Logger.log("Ejecutando getCategorias");
        return jsonOutput(getCategorias());

      case "getCategoriasAdmin":
        Logger.log("Ejecutando getCategoriasAdmin");
        return jsonOutput(getCategoriasAdmin());

      case "testCategorias":
        Logger.log("Ejecutando test de categorías");
        return jsonOutput(testCategorias());

      case "getProductos":
        return jsonOutput(getProductos(e.parameter));

      case "getProducto":
        return jsonOutput(getProducto(e.parameter.id));

      case "getPedidos":
        Logger.log("Ejecutando getPedidos");
        return jsonOutput(getPedidos());

      case "getPedidoDetalle":
        Logger.log("Ejecutando getPedidoDetalle");
        return jsonOutput(getPedidoDetalle(e.parameter.idPedido));

      default:
        throw "Acción GET no válida: " + action;
    }
  } catch (err) {
    Logger.log("Error en doGet: " + err);
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

    if (data.action === "upsertCategoria") {
      return jsonOutput(upsertCategoria(data.categoria));
    }

    if (data.action === "deleteCategoria") {
      return jsonOutput(deleteCategoria(data.id));
    }

    // Fallback: crear pedido (compatibilidad)
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName("pedidos");

    // Obtener el sheet y calcular el próximo número de pedido
    const lastRow = sheet.getLastRow();
    let nextNum = 1;
    if (lastRow > 1) {
      const lastNum = sheet.getRange(lastRow, 1).getValue();
      if (!isNaN(Number(lastNum))) nextNum = Number(lastNum) + 1;
    }

    sheet.appendRow([
      nextNum,
      new Date(),
      data.cliente.nombre,
      data.cliente.ciudad,
      data.total
    ]);

    // Guardar en hoja de detalle con nueva estructura
    const ss2 = SpreadsheetApp.openById(SPREADSHEET_ID);
    const detalleSheet = ss2.getSheetByName("pedido_detalle");
    if (detalleSheet) {
      let detalleLastRow = detalleSheet.getLastRow();
      let nextDetalleId = detalleLastRow;
      data.items.forEach((item, idx) => {
        nextDetalleId++;
        var total_venta = Number(item.precio) * Number(item.cantidad);
        var costo_venta = Math.round(total_venta * 0.7 * 100) / 100; // 70% de total_venta, redondeado a 2 decimales
        detalleSheet.appendRow([
          nextDetalleId, // id (autonumérico por fila)
          nextNum, // id_pedido (consecutivo del pedido)
          item.id || "", // id_producto
          item.nombre,
          item.cantidad,
          item.precio,
          total_venta,
          costo_venta
        ]);
      });
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, pedido_id: nextNum }))
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
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_CATEGORIAS);

    if (!sheet) {
      Logger.log("⚠️ Hoja 'Categorias' no encontrada");
      return { success: false, items: [], error: "Hoja de categorías no encontrada" };
    }

    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      Logger.log("⚠️ Hoja de categorías vacía");
      return { success: true, items: [] };
    }

    const headers = data.shift();

    const idxId = headers.indexOf("id");
    const idxNombre = headers.indexOf("nombre");
    const idxIcono = headers.indexOf("icono");
    const idxOrden = headers.indexOf("orden");
    const idxEstado = headers.indexOf("estado");

    if (idxId === -1 || idxNombre === -1) {
      Logger.log("⚠️ Columnas requeridas no encontradas");
      return { success: false, items: [], error: "Columnas requeridas no encontradas" };
    }

    const items = data
      .filter(r => String(r[idxEstado] || "").toLowerCase().trim() === "activo")
      .map(r => ({
        id: r[idxId],
        nombre: r[idxNombre],
        icono: r[idxIcono] || "",
        orden: Number(r[idxOrden] || 0),
        estado: r[idxEstado] || "activo"
      }));

    Logger.log(`✓ ${items.length} categorías activas cargadas`);
    return { success: true, items: items };
  } catch (error) {
    Logger.log("❌ Error en getCategorias: " + error.toString());
    return { success: false, items: [], error: error.toString() };
  }
}

function getCategoriasAdmin() {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_CATEGORIAS);

    if (!sheet) {
      Logger.log("⚠️ Hoja 'Categorias' no encontrada");
      return { success: false, items: [], error: "Hoja de categorías no encontrada" };
    }

    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      Logger.log("⚠️ Hoja de categorías vacía");
      return { success: true, items: [] };
    }

    const headers = data.shift();

    const idxId = headers.indexOf("id");
    const idxNombre = headers.indexOf("nombre");
    const idxIcono = headers.indexOf("icono");
    const idxOrden = headers.indexOf("orden");
    const idxEstado = headers.indexOf("estado");

    if (idxId === -1 || idxNombre === -1) {
      Logger.log("⚠️ Columnas requeridas no encontradas");
      return { success: false, items: [], error: "Columnas requeridas no encontradas" };
    }

    const items = data.map(r => ({
      id: r[idxId],
      nombre: r[idxNombre],
      icono: r[idxIcono] || "",
      orden: Number(r[idxOrden] || 0),
      estado: r[idxEstado] || "activo"
    }));

    Logger.log(`✓ ${items.length} categorías cargadas para admin`);
    return { success: true, items: items };
  } catch (error) {
    Logger.log("❌ Error en getCategoriasAdmin: " + error.toString());
    return { success: false, items: [], error: error.toString() };
  }
}

function upsertCategoria(categoria) {
  try {
    if (!categoria || !categoria.id || !categoria.nombre) {
      throw new Error("Categoría inválida: faltan campos requeridos");
    }

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_CATEGORIAS);

    if (!sheet) {
      throw new Error("Hoja de categorías no encontrada");
    }

    const data = sheet.getDataRange().getValues();
    const headers = data.shift();

    const idxId = headers.indexOf("id");
    const idxNombre = headers.indexOf("nombre");
    const idxIcono = headers.indexOf("icono");
    const idxOrden = headers.indexOf("orden");
    const idxEstado = headers.indexOf("estado");

    if (idxId === -1 || idxNombre === -1) {
      throw new Error("Columnas requeridas no encontradas en la hoja");
    }

    const idBuscado = String(categoria.id).toLowerCase().trim();

    let rowIndex = -1;
    for (let i = 0; i < data.length; i++) {
      const idRow = String(data[i][idxId] || "").toLowerCase().trim();
      if (idRow === idBuscado) {
        rowIndex = i + 2; // +2 por encabezado y 1-indexed
        break;
      }
    }

    const rowValues = Array(headers.length).fill("");
    rowValues[idxId] = categoria.id;
    rowValues[idxNombre] = categoria.nombre;
    rowValues[idxIcono] = categoria.icono || "";
    rowValues[idxOrden] = Number(categoria.orden || 0);
    rowValues[idxEstado] = categoria.estado || "activo";

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowValues]);
      Logger.log(`✓ Categoría actualizada: ${categoria.nombre}`);
      return { ok: true, updated: true, message: "Categoría actualizada correctamente" };
    }

    sheet.appendRow(rowValues);
    Logger.log(`✓ Categoría creada: ${categoria.nombre}`);
    return { ok: true, created: true, message: "Categoría creada correctamente" };
  } catch (error) {
    Logger.log("❌ Error en upsertCategoria: " + error.toString());
    return { ok: false, error: error.toString() };
  }
}

function deleteCategoria(id) {
  try {
    if (!id) throw new Error("ID inválido");

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_CATEGORIAS);

    if (!sheet) {
      throw new Error("Hoja de categorías no encontrada");
    }

    const data = sheet.getDataRange().getValues();
    const headers = data.shift();

    const idxId = headers.indexOf("id");
    const idBuscado = String(id).toLowerCase().trim();

    for (let i = 0; i < data.length; i++) {
      const idRow = String(data[i][idxId] || "").toLowerCase().trim();
      if (idRow === idBuscado) {
        sheet.deleteRow(i + 2);
        Logger.log(`✓ Categoría eliminada: ${id}`);
        return { ok: true, deleted: true, message: "Categoría eliminada correctamente" };
      }
    }

    Logger.log(`⚠️ Categoría no encontrada: ${id}`);
    return { ok: false, error: "Categoría no encontrada" };
  } catch (error) {
    Logger.log("❌ Error en deleteCategoria: " + error.toString());
    return { ok: false, error: error.toString() };
  }
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

  // Calcular total si no viene en data
  let total = data.total || 0;
  if (!total && data.items && data.items.length > 0) {
    total = data.items.reduce((sum, item) => {
      const precio = Number(item.precio || item.precio_unitario || 0);
      const cantidad = Number(item.cantidad || 1);
      return sum + (precio * cantidad);
    }, 0);
  }

  sheet.appendRow([
    pedidoId,
    new Date(),
    data.cliente,
    data.ciudad,
    JSON.stringify(data.items),
    total,
    "en proceso"
  ]);

  return {
    success: true,
    pedido_id: pedidoId
  };
}

function generarIdPedido() {
  const ss = getSpreadsheet();
  let configSheet = ss.getSheetByName(SHEET_CONFIG);
  
  // Crear hoja Config si no existe
  if (!configSheet) {
    configSheet = ss.insertSheet(SHEET_CONFIG);
    configSheet.appendRow(["contador", "ultimo_id"]);
    configSheet.appendRow(["pedidos", 0]);
  }
  
  // Buscar fila de contador de pedidos
  const data = configSheet.getDataRange().getValues();
  let filaPedidos = -1;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === "pedidos") {
      filaPedidos = i + 1; // +1 porque las filas empiezan en 1
      break;
    }
  }
  
  // Si no existe la fila, crearla
  if (filaPedidos === -1) {
    configSheet.appendRow(["pedidos", 0]);
    filaPedidos = configSheet.getLastRow();
  }
  
  // Obtener y actualizar contador
  const ultimoId = configSheet.getRange(filaPedidos, 2).getValue() || 0;
  const nuevoId = Number(ultimoId) + 1;
  configSheet.getRange(filaPedidos, 2).setValue(nuevoId);
  
  return nuevoId;
}

/*********************************
 * OBTENER PEDIDOS
 *********************************/
function getPedidos() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_PEDIDOS);
  const data = sheet.getDataRange().getValues();
  
  if (data.length < 2) return []; // Solo headers
  
  const headers = data.shift();
  
  // Log para debug
  Logger.log("Headers en Pedidos: " + JSON.stringify(headers));
  
  // Función helper para buscar columna case-insensitive
  const findColumnIndex = (headerName) => {
    const lowerName = String(headerName).toLowerCase().trim();
    return headers.findIndex(h => String(h).toLowerCase().trim() === lowerName);
  };
  
  // Mapear índices de columnas (case-insensitive)
  const idxId = findColumnIndex("id");
  const idxFecha = findColumnIndex("fecha");
  const idxCliente = findColumnIndex("cliente");
  const idxCiudad = findColumnIndex("ciudad");
  const idxItems = findColumnIndex("items");
  const idxTotal = findColumnIndex("total");
  const idxEstado = findColumnIndex("estado");
  
  Logger.log(`Índices encontrados - id: ${idxId}, fecha: ${idxFecha}, cliente: ${idxCliente}, ciudad: ${idxCiudad}`);
  
  return data.map((row, index) => {
    // Obtener ID del row (ahora con índice correcto)
    let pedidoId = idxId >= 0 ? row[idxId] : undefined;
    
    // Validar: solo usar fallback si ID está completamente vacío
    if (pedidoId === undefined || pedidoId === null || String(pedidoId).trim() === "") {
      // Generar ID temporal numérico basado en índice
      pedidoId = 9000 + index + 1;
    } else {
      // Asegurar que sea número si es posible
      const numId = Number(pedidoId);
      if (!isNaN(numId)) {
        pedidoId = numId;
      }
    }
    
    return {
      id: pedidoId,
      fecha: idxFecha >= 0 ? row[idxFecha] : "",
      cliente: idxCliente >= 0 ? row[idxCliente] : "",
      ciudad: idxCiudad >= 0 ? row[idxCiudad] : "",
      items: idxItems >= 0 ? parseJSON(row[idxItems]) : [],
      total: idxTotal >= 0 ? row[idxTotal] : 0,
      estado: idxEstado >= 0 ? (row[idxEstado] || "nuevo") : "nuevo"
    };
  });
}

/*********************************
 * OBTENER DETALLE DE PEDIDO
 *********************************/
function getPedidoDetalle(idPedido) {
  if (!idPedido) throw "ID de pedido requerido";
  
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName("pedido_detalle");
  const data = sheet.getDataRange().getValues();
  
  if (data.length < 2) return []; // Solo headers
  
  const headers = data.shift();
  
  // Mapear índices de columnas
  const idxIdPedido = headers.indexOf("id_pedido");
  const idxProducto = headers.indexOf("producto");
  const idxPrecio = headers.indexOf("precio_unitario");
  const idxCantidad = headers.indexOf("cantidad");
  const idxSubtotal = headers.indexOf("subtotal");
  
  return data
    .filter(row => String(row[idxIdPedido]) === String(idPedido))
    .map(row => ({
      id_pedido: row[idxIdPedido],
      producto: row[idxProducto],
      precio_unitario: row[idxPrecio],
      cantidad: row[idxCantidad],
      subtotal: row[idxSubtotal]
    }));
}

/*********************************
 * UTILIDADES
 *********************************/
function parseJSON(str) {
  try {
    return typeof str === "string" ? JSON.parse(str) : str;
  } catch (e) {
    return str || [];
  }
}

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

function generarPedidoId(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return `PED-${Utilities.formatDate(new Date(), "GMT-5", "yyyyMMdd")}-0001`;
  }

  const lastId = sheet.getRange(lastRow, 1).getValue();
  const num = Number(lastId.split("-").pop()) + 1;

  return `PED-${Utilities.formatDate(new Date(), "GMT-5", "yyyyMMdd")}-${String(num).padStart(4, "0")}`;
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

/*********************************
 * PRUEBA DE CATEGORÍAS
 *********************************/

function testCategorias() {
  Logger.log("🧪 Iniciando prueba de categorías...");

  try {
    // 1. Verificar que la hoja existe
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_CATEGORIAS);

    if (!sheet) {
      Logger.log("❌ ERROR: Hoja '" + SHEET_CATEGORIAS + "' no encontrada");
      Logger.log("📝 Hojas disponibles: " + ss.getSheets().map(s => s.getName()).join(", "));
      return {
        ok: false,
        error: "Hoja no encontrada",
        hojas_disponibles: ss.getSheets().map(s => s.getName())
      };
    }

    Logger.log("✅ Hoja encontrada: " + SHEET_CATEGORIAS);

    // 2. Verificar estructura de datos
    const data = sheet.getDataRange().getValues();
    Logger.log("📊 Datos crudos obtenidos: " + data.length + " filas");

    if (data.length === 0) {
      Logger.log("⚠️ La hoja está vacía");
      return {
        ok: false,
        error: "Hoja vacía",
        filas: 0
      };
    }

    // 3. Verificar encabezados
    const headers = data[0];
    Logger.log("📋 Encabezados encontrados: " + headers.join(", "));

    const requiredHeaders = ["id", "nombre", "icono", "orden", "estado"];
    const missingHeaders = requiredHeaders.filter(h => headers.indexOf(h) === -1);

    if (missingHeaders.length > 0) {
      Logger.log("❌ Faltan columnas requeridas: " + missingHeaders.join(", "));
      return {
        ok: false,
        error: "Columnas faltantes",
        columnas_faltantes: missingHeaders,
        columnas_encontradas: headers
      };
    }

    Logger.log("✅ Todas las columnas requeridas están presentes");

    // 4. Verificar datos de ejemplo
    const sampleData = data.slice(1, 4); // Primeras 3 filas de datos
    Logger.log("📝 Datos de ejemplo:");
    sampleData.forEach((row, i) => {
      Logger.log(`  Fila ${i+1}: [${row.join(" | ")}]`);
    });

    // 5. Probar función getCategorias
    Logger.log("🔄 Probando getCategorias()...");
    const resultadoGet = getCategorias();
    Logger.log("Resultado getCategorias: " + JSON.stringify(resultadoGet, null, 2));

    // 6. Probar función getCategoriasAdmin
    Logger.log("🔄 Probando getCategoriasAdmin()...");
    const resultadoAdmin = getCategoriasAdmin();
    Logger.log("Resultado getCategoriasAdmin: " + JSON.stringify(resultadoAdmin, null, 2));

    // 7. Verificar categorías activas
    const categoriasActivas = resultadoGet.items ? resultadoGet.items.filter(c => c.estado === "activo") : [];
    Logger.log("📊 Categorías activas: " + categoriasActivas.length);

    categoriasActivas.forEach(cat => {
      Logger.log(`  - ${cat.nombre} (${cat.id}): icono="${cat.icono}", orden=${cat.orden}`);
    });

    // 8. Resumen final
    const resumen = {
      ok: resultadoGet.success && resultadoAdmin.success,
      hoja: SHEET_CATEGORIAS,
      filas_totales: data.length,
      filas_datos: data.length - 1,
      columnas: headers.length,
      categorias_activas: categoriasActivas.length,
      categorias_totales: resultadoAdmin.items ? resultadoAdmin.items.length : 0,
      timestamp: new Date().toISOString()
    };

    Logger.log("🎉 Prueba completada exitosamente!");
    Logger.log("📋 Resumen: " + JSON.stringify(resumen, null, 2));

    return resumen;

  } catch (error) {
    Logger.log("❌ ERROR en testCategorias: " + error.toString());
    return {
      ok: false,
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
  }
}
