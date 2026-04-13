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
          return jsonOutput(getCategorias());

        case "getCategoriasAdmin":
          return jsonOutput(getCategoriasAdmin());

        case "getProductos":
          return jsonOutput(getProductos(e.parameter));

        case "getProducto":
          return jsonOutput(getProducto(e.parameter.id));

        case "getPedidos":
          return jsonOutput(getPedidos());

        case "getPedidoDetalle":
          return jsonOutput(getPedidoDetalle(e.parameter.idPedido));

        case "obtenerConfiguracion":
          return jsonOutput(obtenerConfiguracion());

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

      // Gestión de categorías
      if (data.action === "upsertCategoria") {
        return jsonOutput(upsertCategoria(data.categoria));
      }

      if (data.action === "deleteCategoria") {
        return jsonOutput(deleteCategoria(data.id));
      }

      // Notificación a bodega (unificado)
      if (data.action === "enviarNotificacionBodega" || data.action === "enviarPedidoABodega") {
        return jsonOutput(enviarNotificacionBodega(data.pedido_id, data.cliente, data.items));
      }

      // Configuración
      if (data.action === "guardarConfiguracion") {
        return jsonOutput(guardarConfiguracion(data.config));
      }

      if (data.action === "actualizarEstadoPedido") {
        return jsonOutput(actualizarEstadoPedido(data.idPedido, data.estado));
      }

      // Generar URLs de imágenes
      if (data.action === "generarUrlsImagenes") {
        const resultado = generarUrlsImagenes();
        return jsonOutput(resultado);
      }

      // Fallback: crear pedido usando crearPedido() con contador Config
      // Solo se ejecuta si no es ninguna de las acciones anteriores
      if (!data.cliente) {
        throw new Error("Acción no reconocida o datos de cliente faltantes");
      }
      
      const resultado = crearPedido({
        cliente: data.cliente,
        ciudad: data.cliente.ciudad,
        items: data.items,
        total: data.total
      });

      // Guardar detalle
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      const detalleSheet = ss.getSheetByName("pedido_detalle");
      if (detalleSheet) {
        let detalleLastRow = detalleSheet.getLastRow();
        let nextDetalleId = detalleLastRow;
        data.items.forEach((item) => {
          nextDetalleId++;
          const total_venta = Number(item.precio) * Number(item.cantidad);
          const costo_venta = Math.round(total_venta * 0.7 * 100) / 100;
          detalleSheet.appendRow([
            nextDetalleId,
            resultado.pedido_id,
            item.id || "",
            item.nombre,
            item.cantidad,
            item.precio,
            total_venta,
            costo_venta
          ]);
        });
      }

      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, pedido_id: resultado.pedido_id }))
        .setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
      Logger.log("❌ Error en doPost: " + err.message);
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  /*********************************
  * VALIDACIONES Y UTILIDADES
  *********************************/
  function validarKey(e) {
    if (e.parameter.key !== API_KEY) {
      throw "API KEY inválida";
    }
  }

  function getSpreadsheet() {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }

  function parseJSON(str) {
    try {
      return typeof str === "string" ? JSON.parse(str) : str;
    } catch (e) {
      return str || [];
    }
  }

  function jsonOutput(obj) {
    return ContentService
      .createTextOutput(JSON.stringify(obj))
      .setMimeType(ContentService.MimeType.JSON);
  }

  function errorOutput(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  /*********************************
  * CATEGORÍAS
  *********************************/
  function getCategorias() {
    try {
      const ss = getSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_CATEGORIAS);

      if (!sheet) {
        return { success: false, items: [], error: "Hoja de categorías no encontrada" };
      }

      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) {
        return { success: true, items: [] };
      }

      const headers = data.shift();
      const idxId = headers.indexOf("id");
      const idxNombre = headers.indexOf("nombre");
      const idxIcono = headers.indexOf("icono");
      const idxOrden = headers.indexOf("orden");
      const idxEstado = headers.indexOf("estado");

      if (idxId === -1 || idxNombre === -1) {
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
        return { success: false, items: [], error: "Hoja de categorías no encontrada" };
      }

      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) {
        return { success: true, items: [] };
      }

      const headers = data.shift();
      const idxId = headers.indexOf("id");
      const idxNombre = headers.indexOf("nombre");
      const idxIcono = headers.indexOf("icono");
      const idxOrden = headers.indexOf("orden");
      const idxEstado = headers.indexOf("estado");

      if (idxId === -1 || idxNombre === -1) {
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
          rowIndex = i + 2;
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
  * PRODUCTOS
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
      referencia: r[headers.indexOf("referencia")],
      es_nuevo: String(r[headers.indexOf("es_nuevo")] || "").toLowerCase() === "true",
      nuevo_hasta: r[headers.indexOf("nuevo_hasta")] ? String(r[headers.indexOf("nuevo_hasta")]).substring(0, 10) : ""
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
    const idxEsNuevo = headers.indexOf("es_nuevo");
    const idxNuevoHasta = headers.indexOf("nuevo_hasta");

    const catParam = String(categoria || "").toLowerCase().trim();

    const items = data
      .filter(r => {
        const estado = String(r[idxEstado] || "").toLowerCase().trim();
        const cat = String(r[idxCategoria] || "").toLowerCase().trim();
        return estado === "disponible" && (!catParam || cat === catParam);
      })
      .map(r => ({
        id: r[idxId],
        nombre: r[idxNombre],
        precio: r[idxPrecio],
        categoria: r[idxCategoria],
        referencia: r[idxReferencia],
        imagen: convertirDriveUrl(r[idxImagen]),
        es_nuevo: idxEsNuevo >= 0 ? (String(r[idxEsNuevo] || "").toLowerCase() === "true") : false,
        nuevo_hasta: idxNuevoHasta >= 0 && r[idxNuevoHasta] ? String(r[idxNuevoHasta]).substring(0, 10) : ""
      }));

    return items;
  }

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
  * PEDIDOS
  *********************************/
  function getPedidos() {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_PEDIDOS);
    const data = sheet.getDataRange().getValues();
    
    if (data.length < 2) return [];
    
    const headers = data.shift();
    
    const findColumnIndex = (headerName) => {
      const lowerName = String(headerName).toLowerCase().trim();
      return headers.findIndex(h => String(h).toLowerCase().trim() === lowerName);
    };
    
    const idxIdPedido = findColumnIndex("id_pedido");
    const idxId = findColumnIndex("id");
    const idxFecha = findColumnIndex("fecha");
    const idxCliente = findColumnIndex("cliente");
    const idxCiudad = findColumnIndex("ciudad");
    const idxItems = findColumnIndex("items");
    const idxTotal = findColumnIndex("total");
    const idxEstado = findColumnIndex("estado");
    
    return data.map((row, index) => {
      let pedidoId = idxIdPedido >= 0
        ? row[idxIdPedido]
        : (idxId >= 0 ? row[idxId] : undefined);
      
      if (pedidoId === undefined || pedidoId === null || String(pedidoId).trim() === "") {
        pedidoId = 9000 + index + 1;
      } else {
        const numId = Number(pedidoId);
        if (!isNaN(numId)) pedidoId = numId;
      }
      
      return {
        id: pedidoId,
        id_pedido: idxIdPedido >= 0 ? row[idxIdPedido] : pedidoId,
        fecha: idxFecha >= 0 ? row[idxFecha] : "",
        cliente: idxCliente >= 0 ? row[idxCliente] : "",
        ciudad: idxCiudad >= 0 ? row[idxCiudad] : "",
        items: idxItems >= 0 ? parseJSON(row[idxItems]) : [],
        total: idxTotal >= 0 ? row[idxTotal] : 0,
        estado: idxEstado >= 0 ? (row[idxEstado] || "nuevo") : "nuevo"
      };
    });
  }

  function getPedidoDetalle(idPedido) {
    if (!idPedido) throw "ID de pedido requerido";
    
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName("pedido_detalle");
    const data = sheet.getDataRange().getValues();
    
    if (data.length < 2) return [];
    
    const headers = data.shift();
    const idxIdPedido = headers.indexOf("id_pedido");
    const idxIdProducto = headers.indexOf("id_producto");
    const idxId = headers.indexOf("id");
    const idxCodigo = headers.indexOf("codigo");
    const idxProducto = headers.indexOf("producto");
    const idxPrecio = headers.indexOf("precio_unitario");
    const idxCantidad = headers.indexOf("cantidad");
    const idxSubtotal = headers.indexOf("subtotal");
    const idxTotalVenta = headers.indexOf("total_venta");
    const idxCostoVenta = headers.indexOf("costo_venta");

    const productosSheet = ss.getSheetByName(SHEET_PRODUCTOS);
    const productosMap = {};
    if (productosSheet) {
      const productosData = productosSheet.getDataRange().getValues();
      if (productosData.length > 1) {
        const pHeaders = productosData.shift();
        const pIdxId = pHeaders.indexOf("id");
        const pIdxNombre = pHeaders.indexOf("nombre");
        const pIdxReferencia = pHeaders.indexOf("referencia");
        const pIdxContabilidad = pHeaders.indexOf("contabilidad");
        const pIdxPrecio2 = pHeaders.indexOf("precio2");
        const pIdxPrecio3 = pHeaders.indexOf("precio3");
        const pIdxPrecio1 = pHeaders.indexOf("precio");

        productosData.forEach(pRow => {
          const key = String(pRow[pIdxId] || "").trim();
          if (!key) return;
          productosMap[key] = {
            nombre: pIdxNombre >= 0 ? pRow[pIdxNombre] : "",
            referencia: pIdxReferencia >= 0 ? pRow[pIdxReferencia] : "",
            contabilidad: pIdxContabilidad >= 0 ? pRow[pIdxContabilidad] : "",
            precio2: pIdxPrecio2 >= 0 ? pRow[pIdxPrecio2] : "",
            precio3: pIdxPrecio3 >= 0 ? pRow[pIdxPrecio3] : "",
            precio1: pIdxPrecio1 >= 0 ? pRow[pIdxPrecio1] : ""
          };
        });
      }
    }
    
    return data
      .filter(row => String(row[idxIdPedido]) === String(idPedido))
      .map(row => {
        const idProducto = idxIdProducto >= 0
          ? row[idxIdProducto]
          : (idxCodigo >= 0 ? row[idxCodigo] : (idxId >= 0 ? row[idxId] : ""));
        const productoInfo = productosMap[String(idProducto || "").trim()] || {};

        return {
          id_pedido: row[idxIdPedido],
          id_producto: idProducto,
          producto: row[idxProducto] || productoInfo.nombre || "",
          referencia: productoInfo.referencia || "",
          contabilidad: productoInfo.contabilidad || "",
          precio2: productoInfo.precio2 || "",
          precio3: productoInfo.precio3 || "",
          precio1: productoInfo.precio1 || "",
          precio_unitario: row[idxPrecio],
          cantidad: row[idxCantidad],
          subtotal: idxSubtotal >= 0 ? row[idxSubtotal] : "",
          total_venta: idxTotalVenta >= 0 ? row[idxTotalVenta] : "",
          costo_venta: idxCostoVenta >= 0 ? row[idxCostoVenta] : ""
        };
      });
  }

  function actualizarEstadoPedido(idPedido, nuevoEstado) {
    if (!idPedido) {
      return { ok: false, error: "ID de pedido requerido" };
    }

    if (!nuevoEstado) {
      return { ok: false, error: "Estado requerido" };
    }

    try {
      const ss = getSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_PEDIDOS);

      if (!sheet) {
        return { ok: false, error: "Hoja Pedidos no encontrada" };
      }

      const data = sheet.getDataRange().getValues();
      if (data.length < 2) {
        return { ok: false, error: "No hay pedidos registrados" };
      }

      const normalizarId = (value) => {
        const raw = String(value ?? "").trim();
        if (!raw) return "";
        const sinDecimalFinal = raw.replace(/\.0+$/, "");
        return sinDecimalFinal.replace(/\s+/g, "");
      };

      const headers = data.shift().map(h => String(h).toLowerCase().trim());
      const idxEstado = headers.indexOf("estado");
      const idxIdPedido = headers.indexOf("id_pedido");
      const idxPedidoId = headers.indexOf("pedido_id");
      const idxId = headers.indexOf("id");

      if (idxEstado === -1) {
        return { ok: false, error: "Columna estado no encontrada" };
      }

      const idBuscado = normalizarId(idPedido);
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowIdPedido = idxIdPedido >= 0 ? row[idxIdPedido] : "";
        const rowPedidoId = idxPedidoId >= 0 ? row[idxPedidoId] : "";
        const rowId = idxId >= 0 ? row[idxId] : "";
        const coincide = [rowIdPedido, rowPedidoId, rowId]
          .map(normalizarId)
          .some(idFila => idFila && idFila === idBuscado);

        if (!coincide) continue;

        sheet.getRange(i + 2, idxEstado + 1).setValue(nuevoEstado);
        return {
          ok: true,
          idPedido: idPedido,
          estado: nuevoEstado,
          rowUpdated: i + 2
        };
      }

      return { ok: false, error: "Pedido no encontrado" };
    } catch (error) {
      return { ok: false, error: error.toString() };
    }
  }

  /*********************************
  * IMÁGENES
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
      const redirectUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
      return HtmlService.createHtmlOutput(
        `<script>window.location.href="${redirectUrl}"</script>`
      );
    }
  }

  /*********************************
  * NOTIFICACIÓN A BODEGA
  *********************************/
  function enviarNotificacionBodega(pedidoId, cliente, items) {
    try {
      const ss = getSpreadsheet();
      const configSheet = ss.getSheetByName(SHEET_CONFIG);
      
      if (!configSheet) {
        return { success: false, error: "Hoja de configuración no encontrada" };
      }
      
      const configData = configSheet.getDataRange().getValues();
      let correoBodega = null;
      
      configData.forEach(row => {
        if (String(row[0]).toLowerCase() === "correo_bodega") {
          correoBodega = String(row[1]).trim();
        }
      });
      
      if (!correoBodega) {
        Logger.log("⚠️ Correo de bodega no configurado");
        return { success: false, warning: "Correo de bodega no configurado" };
      }
      
      let itemsHtml = '';
      items.forEach((item) => {
        const nombreProducto = item.nombre || item.producto || item.descripcion || item.referencia || "N/A";
        const codigoContable = item.codigo_contable || item.id_producto || item.codigo || item.sku || item.referencia || item.id || "N/A";
        const precioNumerico = Number(item.precio_unitario || item.precio || 0);
        const precioUnitario = Number.isFinite(precioNumerico) && precioNumerico > 0
          ? `$ ${precioNumerico.toLocaleString('es-CO')}`
          : "N/A";

        itemsHtml += `
          <tr style="border-bottom: 1px solid #e7e7e7;">
            <td style="padding: 4px 4px; width: 50%; font-weight: 600; font-size: 11px; line-height: 1.2; word-break: break-word;">${nombreProducto}</td>
            <td style="padding: 4px 4px; width: 12%; font-size: 11px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${codigoContable}</td>
            <td style="padding: 4px 4px; width: 20%; text-align: right; font-size: 11px; line-height: 1.2; white-space: nowrap;">${precioUnitario}</td>
            <td style="padding: 4px 4px; width: 10%; text-align: center; font-weight: 600; font-size: 11px; line-height: 1.2;">${item.cantidad || 0}</td>
            <td style="padding: 4px 4px; width: 8%; text-align: center; font-size: 14px; line-height: 1;">☐</td>
          </tr>
        `;
      });
      
      const fechaActual = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
      const horaActual = new Date().toLocaleTimeString('es-CO');
      
      const asunto = `[PEDIDO #${pedidoId}] Alisting de Bodega - ${cliente.nombre}`;
      const cuerpoHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            @media print {
              body { padding: 0 !important; background: #ffffff !important; }
              .mail-wrap {
                max-width: 100% !important;
                margin: 0 !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                padding: 8px !important;
              }
            }
          </style>
        </head>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 8px; color: #333; background-color: #f5f5f5; font-size: 12px; line-height: 1.3;">
          <div class="mail-wrap" style="max-width: 760px; margin: 0 auto; background: white; padding: 12px; border-radius: 6px; box-shadow: 0 1px 6px rgba(0,0,0,0.08);">
            <div style="border-bottom: 2px solid #c62828; padding-bottom: 8px; margin-bottom: 10px;">
              <h1 style="margin: 0 0 4px 0; color: #c62828; font-size: 17px; line-height: 1.2;">FORMATO DE ALISTING - BODEGA</h1>
              <p style="margin: 0; color: #666; font-size: 10px;">Generado: ${fechaActual} ${horaActual}</p>
            </div>
            
            <div style="background: #f9f9f9; padding: 8px 10px; border-radius: 6px; margin-bottom: 10px;">
              <p style="margin: 2px 0; font-size: 11px;"><strong>Pedido #:</strong> ${pedidoId}</p>
              <p style="margin: 2px 0; font-size: 11px;"><strong>Cliente:</strong> ${cliente.nombre || 'N/A'}</p>
              <p style="margin: 2px 0; font-size: 11px;"><strong>Ciudad:</strong> ${cliente.ciudad || 'N/A'}</p>
              <p style="margin: 2px 0; font-size: 11px;"><strong>Teléfono:</strong> ${cliente.telefono || 'No proporcionado'}</p>
              ${cliente.notas ? `<p style="margin: 2px 0; font-size: 11px;"><strong>Notas:</strong> ${cliente.notas}</p>` : ''}
            </div>
            
            <h2 style="color: #c62828; margin: 0 0 6px 0; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; font-size: 13px;">ARTÍCULOS A ALISTAR</h2>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; table-layout: fixed;">
              <thead>
                <tr style="background: #c62828; color: white;">
                  <th style="padding: 5px 4px; width: 50%; text-align: left; font-weight: 600; font-size: 10px;">Producto</th>
                  <th style="padding: 5px 4px; width: 12%; text-align: left; font-weight: 600; font-size: 10px;">Codigo contable</th>
                  <th style="padding: 5px 4px; width: 20%; text-align: right; font-weight: 600; font-size: 10px;">Precio unitario</th>
                  <th style="padding: 5px 4px; width: 10%; text-align: center; font-weight: 600; font-size: 10px;">Cant.</th>
                  <th style="padding: 5px 4px; width: 8%; text-align: center; font-weight: 600; font-size: 10px;">Alist.</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>
            
            <div style="background: #fff3e0; border-left: 3px solid #ff9800; padding: 8px 10px; margin-top: 8px;">
              <h3 style="margin: 0 0 6px 0; color: #ff9800; font-size: 12px;">INSTRUCCIONES</h3>
              <ol style="margin: 0; padding-left: 16px; color: #555; font-size: 10px; line-height: 1.2;">
                <li>Verificar existencias de cada artículo en inventario</li>
                <li>Alistar los productos en el orden listado</li>
                <li>Marcar con un ✓ cada artículo allistado</li>
                <li>Verificar cantidades antes de empacar</li>
                <li>Preparar etiqueta de envío con datos del cliente</li>
              </ol>
            </div>
            
            <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #999;">
              <p style="margin: 0;">Documento generado automáticamente desde NIA CALI</p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      GmailApp.sendEmail(
        correoBodega,
        asunto,
        "Por favor habilita la visualización de HTML para ver este correo correctamente.",
        {
          htmlBody: cuerpoHTML,
          name: "NIA CALI - Sistema de Pedidos"
        }
      );
      
      Logger.log("✅ Notificación enviada a bodega: " + correoBodega);
      return { success: true, message: "Notificación enviada a " + correoBodega };
    } catch (error) {
      Logger.log("❌ Error enviando notificación a bodega: " + error.toString());
      return { success: false, error: error.toString() };
    }
  }

  /**
  * FUNCIÓN DE PRUEBA - Autorizar permisos de Gmail
  */
  function autorizarPermisosGmail() {
    const datosTest = {
      pedido_id: "TEST-001",
      cliente: {
        nombre: "Cliente de Prueba",
        ciudad: "Cali",
        telefono: "3001234567",
        notas: "Esta es una prueba de autorización"
      },
      items: [
        { nombre: "Producto Test 1", categoria: "Prueba", cantidad: 2, precio: 10000 },
        { nombre: "Producto Test 2", categoria: "Prueba", cantidad: 1, precio: 5000 }
      ]
    };
    
    Logger.log("🔑 Iniciando prueba de autorización de Gmail...");
    const resultado = enviarNotificacionBodega(datosTest.pedido_id, datosTest.cliente, datosTest.items);
    Logger.log("Resultado: " + JSON.stringify(resultado));
    return resultado;
  }

  /*********************************
  * CONFIGURACIÓN
  *********************************/
  function obtenerConfiguracion() {
    try {
      const ss = getSpreadsheet();
      const configSheet = ss.getSheetByName(SHEET_CONFIG);

      if (!configSheet) {
        return {
          success: true,
          correo_bodega: null,
          warning: "Hoja de configuración no encontrada"
        };
      }

      const configData = configSheet.getDataRange().getValues();
      const config = {};

      configData.forEach(row => {
        if (row.length >= 2) {
          const clave = String(row[0]).toLowerCase().trim();
          const valor = String(row[1]).trim();
          config[clave] = valor;
        }
      });

      Logger.log("✓ Configuración cargada: " + JSON.stringify(config));

      // Retorna TODAS las claves de la hoja Config dinámicamente.
      // Así cualquier clave nueva (whatsapp_bodega, etc.) está disponible
      // sin necesidad de modificar este código nuevamente.
      return Object.assign({ success: true }, config);
    } catch (error) {
      Logger.log("❌ Error obteniendo configuración: " + error.toString());
      return {
        success: false,
        error: error.toString()
      };
    }
  }

  /**
  * Autorizar permisos de Gmail - EJECUTAR ESTO PRIMERO
  * Nota: Cuando ejecutes esta función por primera vez, Google te pedirá autorización
  */
  function autorizarGmail() {
    Logger.log("🔑 Autorizando permisos de Gmail...");
    try {
      const user = Session.getEffectiveUser().getEmail();
      Logger.log("✅ Usuario actual: " + user);
      Logger.log("✅ Permisos de Gmail autorizados correctamente");
      Logger.log("\n💡 Ahora puedes usar probarCorreo() o cualquier función que envíe emails");
      return { success: true, message: "Permisos autorizados", user: user };
    } catch (error) {
      Logger.log("❌ Error: " + error.toString());
      return { success: false, error: error.toString() };
    }
  }

  /*********************************
  * PRUEBAS Y DIAGNÓSTICO
  *********************************/

  /**
  * Prueba completa del sistema por sectores
  */
  function probarSistema() {
    Logger.log("=== 🧪 PRUEBA COMPLETA DEL SISTEMA ===\n");
    
    const resultados = {
      timestamp: new Date().toISOString(),
      sectores: {}
    };

    // 1. PRUEBA: Configuración
    resultados.sectores.configuracion = probarConfiguracion();
    
    // 2. PRUEBA: Categorías
    resultados.sectores.categorias = probarCategorias();
    
    // 3. PRUEBA: Productos
    resultados.sectores.productos = probarProductos();
    
    // 4. PRUEBA: Imágenes
    resultados.sectores.imagenes = probarImagenes();
    
    // 5. PRUEBA: Envío de correo
    resultados.sectores.correo = probarCorreo();

    // 6. PRUEBA: Lectura de pedidos
    resultados.sectores.pedidos = probarPedidos();

    // 7. PRUEBA: Inserción y contador de pedidos
    resultados.sectores.contador_pedidos = probarInsercionPedidoTemporal();
    
    // Resumen
    resultados.ok = Object.values(resultados.sectores).every(s => s.ok !== false);
    if (resultados.sectores.contador_pedidos && resultados.sectores.contador_pedidos.incremento_correcto === false) {
      resultados.ok = false;
      Logger.log("⚠️ ALERTA: El contador de pedidos no incrementó correctamente");
      resultados.alerta_contador = "El contador de pedidos no incrementó correctamente";
    }
    
    Logger.log("\n=== 📊 RESUMEN FINAL ===");
    Logger.log(JSON.stringify(resultados, null, 2));
    
    return resultados;
  }

  /**
  * Prueba 6: Pedidos (lectura y numeracion)
  */
  function probarPedidos() {
    Logger.log("\n🧾 PRUEBA: PEDIDOS");
    Logger.log("─".repeat(50));

    try {
      const ss = getSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_PEDIDOS);

      if (!sheet) {
        Logger.log("❌ Hoja '" + SHEET_PEDIDOS + "' no encontrada");
        return { ok: false, error: "Hoja no encontrada" };
      }

      const data = sheet.getDataRange().getValues();
      if (data.length < 2) {
        Logger.log("⚠️ Hoja de pedidos sin datos");
        return { ok: true, warning: "Sin datos" };
      }

      const headers = data[0].map(h => String(h).toLowerCase().trim());
      const idxIdPedido = headers.indexOf("id_pedido");
      const idxFecha = headers.indexOf("fecha");

      Logger.log("✅ Encabezados: " + headers.join(", "));
      Logger.log("   idx id_pedido: " + idxIdPedido + ", idx fecha: " + idxFecha);

      const pedidos = getPedidos();
      const sample = pedidos.slice(0, 5).map(p => ({ id: p.id, id_pedido: p.id_pedido, fecha: p.fecha }));
      const faltantes = pedidos.filter(p => p.id === undefined || p.id === null || String(p.id).trim() === "").length;

      Logger.log("   Total pedidos: " + pedidos.length);
      Logger.log("   IDs faltantes: " + faltantes);
      Logger.log("   Muestra (5): " + JSON.stringify(sample));

      return {
        ok: idxIdPedido >= 0,
        total: pedidos.length,
        idx_id_pedido: idxIdPedido,
        missing_ids: faltantes,
        sample: sample
      };
    } catch (error) {
      Logger.log("❌ Error en probarPedidos: " + error.toString());
      return { ok: false, error: error.toString() };
    }
  }

  /**
  * Prueba 1: Configuración
  */
  function probarConfiguracion() {
    Logger.log("\n🔧 PRUEBA: CONFIGURACIÓN");
    Logger.log("─".repeat(50));
    
    try {
      const resultado = obtenerConfiguracion();
      
      if (!resultado.success) {
        Logger.log("❌ Error: " + resultado.error);
        return { ok: false, error: resultado.error };
      }
      
      Logger.log("✅ Configuración obtenida correctamente");
      Logger.log("   Correo bodega: " + (resultado.correo_bodega || "⚠️ No configurado"));
      
      return {
        ok: true,
        correo_bodega: resultado.correo_bodega,
        message: "Configuración accesible"
      };
    } catch (error) {
      Logger.log("❌ Error en probarConfiguracion: " + error.toString());
      return { ok: false, error: error.toString() };
    }
  }

  /**
  * Prueba 2: Categorías
  */
  function probarCategorias() {
    Logger.log("\n📂 PRUEBA: CATEGORÍAS");
    Logger.log("─".repeat(50));
    
    try {
      const ss = getSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_CATEGORIAS);
      
      if (!sheet) {
        Logger.log("❌ Hoja '" + SHEET_CATEGORIAS + "' no encontrada");
        return { ok: false, error: "Hoja no encontrada" };
      }
      
      Logger.log("✅ Hoja encontrada: " + SHEET_CATEGORIAS);
      
      const data = sheet.getDataRange().getValues();
      Logger.log("   Filas totales: " + data.length);
      Logger.log("   Encabezados: " + data[0].join(", "));
      
      const resultado = getCategorias();
      Logger.log("   Categorías activas: " + resultado.items.length);
      
      resultado.items.slice(0, 3).forEach(cat => {
        Logger.log(`   - ${cat.nombre} (${cat.id}): orden=${cat.orden}`);
      });
      
      return {
        ok: true,
        total: resultado.items.length,
        sample: resultado.items.slice(0, 3)
      };
    } catch (error) {
      Logger.log("❌ Error en probarCategorias: " + error.toString());
      return { ok: false, error: error.toString() };
    }
  }

  /**
  * Prueba 3: Productos
  */
  function probarProductos() {
    Logger.log("\n📦 PRUEBA: PRODUCTOS");
    Logger.log("─".repeat(50));
    
    try {
      const ss = getSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_PRODUCTOS);
      
      if (!sheet) {
        Logger.log("❌ Hoja '" + SHEET_PRODUCTOS + "' no encontrada");
        return { ok: false, error: "Hoja no encontrada" };
      }
      
      Logger.log("✅ Hoja encontrada: " + SHEET_PRODUCTOS);
      
      const data = sheet.getDataRange().getValues();
      Logger.log("   Filas totales: " + data.length);
      Logger.log("   Encabezados: " + data[0].join(", "));
      
      const resultado = getProductos({ offset: 0, limit: 5, categoria: "" });
      Logger.log("   Productos disponibles: " + resultado.total);
      Logger.log("   Productos cargados: " + resultado.items.length);
      
      resultado.items.slice(0, 3).forEach(prod => {
        Logger.log(`   - ${prod.nombre}: $${prod.precio} (${prod.categoria})`);
      });
      
      return {
        ok: true,
        total: resultado.total,
        items: resultado.items.length,
        sample: resultado.items.slice(0, 3)
      };
    } catch (error) {
      Logger.log("❌ Error en probarProductos: " + error.toString());
      return { ok: false, error: error.toString() };
    }
  }

  /**
  * Prueba 4: Imágenes
  */
  function probarImagenes() {
    Logger.log("\n🖼️ PRUEBA: IMÁGENES");
    Logger.log("─".repeat(50));
    
    try {
      const ss = getSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_PRODUCTOS);
      const data = sheet.getDataRange().getValues();
      
      if (data.length < 2) {
        Logger.log("⚠️ No hay productos para probar imágenes");
        return { ok: true, warning: "No hay productos" };
      }
      
      const headers = data[0];
      const idxImagen = headers.indexOf("Url_Imagen_Drive");
      
      if (idxImagen === -1) {
        Logger.log("❌ Columna 'Url_Imagen_Drive' no encontrada");
        return { ok: false, error: "Columna no encontrada" };
      }
      
      Logger.log("✅ Columna de imágenes encontrada");
      
      // Encontrar primer producto con imagen
      let productoConImagen = null;
      for (let i = 1; i < data.length; i++) {
        if (data[i][idxImagen]) {
          productoConImagen = data[i];
          break;
        }
      }
      
      if (!productoConImagen) {
        Logger.log("⚠️ Ningún producto tiene imagen");
        return { ok: true, warning: "Ningún producto con imagen" };
      }
      
      const fileId = extraerFileId(productoConImagen[idxImagen]);
      Logger.log("   FileId extraído: " + fileId);
      
      const proxyUrl = construirProxyUrl(fileId);
      Logger.log("   URL de proxy: " + proxyUrl.substring(0, 60) + "...");
      
      // Intentar acceder a la imagen
      try {
        const response = UrlFetchApp.fetch(proxyUrl, { muteHttpExceptions: true });
        const status = response.getResponseCode();
        Logger.log("   Status HTTP: " + status);
        
        if (status === 200) {
          Logger.log("✅ Imagen accesible");
          return { ok: true, status: status, fileId: fileId };
        } else {
          Logger.log("⚠️ Imagen no accesible (status " + status + ")");
          return { ok: true, warning: "Status " + status, fileId: fileId };
        }
      } catch (err) {
        Logger.log("⚠️ Error al acceder a imagen: " + err.toString());
        return { ok: true, warning: err.toString() };
      }
    } catch (error) {
      Logger.log("❌ Error en probarImagenes: " + error.toString());
      return { ok: false, error: error.toString() };
    }
  }

  /**
  * Prueba 5: Envío de correo
  */
  function probarCorreo() {
    Logger.log("\n📧 PRUEBA: ENVÍO DE CORREO");
    Logger.log("─".repeat(50));
    
    try {
      // Obtener correo de bodega
      const configResult = obtenerConfiguracion();
      
      if (!configResult.correo_bodega) {
        Logger.log("⚠️ Correo de bodega no configurado");
        return { ok: true, warning: "Correo de bodega no configurado" };
      }
      
      Logger.log("✅ Correo de bodega encontrado: " + configResult.correo_bodega);
      
      // Enviar correo de prueba
      const datosTest = {
        pedido_id: "TEST-" + new Date().getTime(),
        cliente: {
          nombre: "Prueba Automática",
          ciudad: "Cali",
          telefono: "3001234567",
          notas: "Correo de prueba - " + new Date().toLocaleString('es-CO')
        },
        items: [
          { nombre: "Producto Prueba 1", categoria: "Test", cantidad: 2, precio: 50000 },
          { nombre: "Producto Prueba 2", categoria: "Test", cantidad: 1, precio: 30000 }
        ]
      };
      
      Logger.log("   Enviando correo de prueba...");
      const resultado = enviarNotificacionBodega(
        datosTest.pedido_id,
        datosTest.cliente,
        datosTest.items
      );
      
      if (resultado.success) {
        Logger.log("✅ Correo enviado exitosamente");
        Logger.log("   Mensaje: " + resultado.message);
        return { ok: true, success: true, message: resultado.message };
      } else if (resultado.warning) {
        Logger.log("⚠️ Advertencia: " + resultado.warning);
        return { ok: true, warning: resultado.warning };
      } else {
        Logger.log("❌ Error al enviar: " + resultado.error);
        return { ok: false, error: resultado.error };
      }
    } catch (error) {
      Logger.log("❌ Error en probarCorreo: " + error.toString());
      return { ok: false, error: error.toString() };
    }
  }

  /*********************************
  * CREAR PEDIDO
  *********************************/
  function generarIdPedido() {
    const ss = getSpreadsheet();
    const configSheet = ss.getSheetByName(SHEET_CONFIG);
    
    if (!configSheet) {
      throw new Error("Hoja Config no encontrada");
    }
    
    const configData = configSheet.getDataRange().getValues();
    let filaPedidos = -1;
    let ultimoId = 0;
    
    for (let i = 0; i < configData.length; i++) {
      if (String(configData[i][0]).toLowerCase().trim() === "pedidos") {
        filaPedidos = i + 1;
        ultimoId = Number(configData[i][1] || 0);
        break;
      }
    }
    
    if (filaPedidos === -1) {
      configSheet.appendRow(["pedidos", 1]);
      return 1;
    }
    
    const nuevoId = ultimoId + 1;
    configSheet.getRange(filaPedidos, 2).setValue(nuevoId);
    
    return nuevoId;
  }

  function crearPedido(pedido) {
    try {
      const ss = getSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_PEDIDOS);
      
      if (!sheet) {
        throw new Error("Hoja Pedidos no encontrada");
      }
      
      const idPedido = generarIdPedido();
      const fecha = new Date();
      const cliente = pedido.cliente.nombre || "";
      const ciudad = pedido.cliente.ciudad || pedido.ciudad || "";
      const total = pedido.total || 0;
      const estado = "pendiente";
      
      sheet.appendRow([
        idPedido,
        fecha,
        cliente,
        ciudad,
        total,
        estado
      ]);
      
      Logger.log(`✅ Pedido creado: #${idPedido}`);
      
      return {
        ok: true,
        pedido_id: idPedido
      };
    } catch (error) {
      Logger.log("❌ Error en crearPedido: " + error.toString());
      throw error;
    }
  }

  function probarInsercionPedidoTemporal() {
    Logger.log("\n🧪 PRUEBA: INSERCIÓN Y LIMPIEZA DE PEDIDO");
    Logger.log("─".repeat(50));

    try {
      const ss = getSpreadsheet();
      const sheet = ss.getSheetByName(SHEET_PEDIDOS);
      if (!sheet) {
        Logger.log("❌ Hoja 'Pedidos' no encontrada");
        return { ok: false, error: "Hoja Pedidos no encontrada" };
      }

      const headers = sheet.getDataRange().getValues()[0].map(h => String(h).toLowerCase().trim());
      const requeridos = ["id_pedido", "fecha", "cliente", "ciudad", "total", "estado"];
      const faltantes = requeridos.filter(r => headers.indexOf(r) === -1);
      if (faltantes.length > 0) {
        Logger.log("❌ Faltan columnas: " + faltantes.join(", "));
        return { ok: false, error: "Columnas faltantes", faltantes };
      }

      const configSheet = ss.getSheetByName(SHEET_CONFIG);
      if (!configSheet) {
        Logger.log("❌ Hoja Config no encontrada");
        return { ok: false, error: "Hoja Config no encontrada" };
      }

      const configData = configSheet.getDataRange().getValues();
      let filaPedidos = -1;
      for (let i = 1; i < configData.length; i++) {
        if (String(configData[i][0]).toLowerCase().trim() === "pedidos") {
          filaPedidos = i + 1;
          break;
        }
      }

      if (filaPedidos === -1) {
        configSheet.appendRow(["pedidos", 0]);
        filaPedidos = configSheet.getLastRow();
      }

      const ultimoIdAntes = Number(configSheet.getRange(filaPedidos, 2).getValue() || 0);

      const pedidoTest = {
        cliente: { nombre: "TEST AUTO", ciudad: "Cali" },
        ciudad: "Cali",
        items: [
          { nombre: "Producto Test", cantidad: 1, precio: 1000 }
        ],
        total: 1000
      };

      const beforeLastRow = sheet.getLastRow();
      const resultado = crearPedido(pedidoTest);
      const afterLastRow = sheet.getLastRow();

      if (afterLastRow !== beforeLastRow + 1) {
        Logger.log("❌ No se insertó el pedido correctamente");
        return { ok: false, error: "Inserción fallida" };
      }

      const idxId = headers.indexOf("id_pedido") + 1;
      const lastId = sheet.getRange(afterLastRow, idxId).getValue();

      if (String(lastId) !== String(resultado.pedido_id)) {
        Logger.log("⚠️ ID insertado no coincide con resultado");
      }

      sheet.deleteRow(afterLastRow);

      const ultimoIdDespues = Number(configSheet.getRange(filaPedidos, 2).getValue() || 0);
      const incrementoCorrecto = ultimoIdDespues === ultimoIdAntes + 1;

      configSheet.getRange(filaPedidos, 2).setValue(ultimoIdAntes);

      Logger.log("✅ Pedido de prueba insertado y eliminado");
      Logger.log("   Pedido ID: " + resultado.pedido_id);

      return {
        ok: true,
        pedido_id: resultado.pedido_id,
        insertado: true,
        eliminado: true,
        contador_antes: ultimoIdAntes,
        contador_despues: ultimoIdDespues,
        incremento_correcto: incrementoCorrecto
      };
    } catch (error) {
      Logger.log("❌ Error en prueba: " + error.toString());
      return { ok: false, error: error.toString() };
    }
  }

  function guardarConfiguracion(config) {
    try {
      const ss = getSpreadsheet();
      const configSheet = ss.getSheetByName(SHEET_CONFIG);

      if (!configSheet) {
        return {
          success: false,
          error: "Hoja de configuración no encontrada"
        };
      }

      const configData = configSheet.getDataRange().getValues();
      const headers = configData[0] || ["clave", "valor"];

      for (const [clave, valor] of Object.entries(config)) {
        const claveNormalizada = clave.toLowerCase().trim();
        
        let filaEncontrada = -1;
        for (let i = 0; i < configData.length; i++) {
          if (String(configData[i][0]).toLowerCase().trim() === claveNormalizada) {
            filaEncontrada = i;
            break;
          }
        }

        if (filaEncontrada >= 0) {
          configSheet.getRange(filaEncontrada + 1, 2).setValue(valor);
          Logger.log(`✓ Actualizado: ${clave} = ${valor}`);
        } else {
          configSheet.appendRow([clave, valor]);
          Logger.log(`✓ Agregado: ${clave} = ${valor}`);
        }
      }

      return {
        success: true,
        message: "Configuración guardada correctamente"
      };
    } catch (error) {
      Logger.log("❌ Error guardando configuración: " + error.toString());
      return {
        success: false,
        error: error.toString()
      };
    }
  }

  function generarUrlsImagenes() {
    try {
      const ss = getSpreadsheet();
      let sheet = ss.getSheetByName("productos");
      let modoProductos = false;

      if (!sheet) {
        sheet = ss.getSheetByName(SHEET_PRODUCTOS);
        modoProductos = true;
      }

      if (!sheet) {
        throw new Error("No existe la hoja 'prueba' ni la hoja de productos");
      }

      const lastRow = sheet.getLastRow();
      if (lastRow < 2) {
        return {
          success: false,
          error: "No hay datos en la hoja"
        };
      }

      const data = sheet.getDataRange().getValues();
      let idxCodigo = 0;
      let idxUrlImagen = 4;

      if (modoProductos) {
        const headers = data[0];
        const candidatosCodigo = ["referencia", "codigo", "id", "sku"];
        const candidatosUrl = ["Url_Imagen_Drive", "url_imagen", "imagen"];

        idxCodigo = headers.findIndex(h => candidatosCodigo.includes(String(h).trim()));
        idxUrlImagen = headers.findIndex(h => candidatosUrl.includes(String(h).trim()));

        if (idxCodigo === -1 || idxUrlImagen === -1) {
          return {
            success: false,
            error: "No se encontraron las columnas de código o URL de imagen"
          };
        }
      }

      // Indexar imágenes del Drive
      const folder = DriveApp.getFolderById(DRIVE_IMAGES_FOLDER_ID);
      const files = folder.getFiles();
      const index = {};

      while (files.hasNext()) {
        const file = files.next();
        if (!file.getMimeType().startsWith("image/")) continue;

        const nombreSinExt = file
          .getName()
          .replace(/\.[^/.]+$/, "")
          .trim();

        index[nombreSinExt] = file.getId();
      }

      // Actualizar URLs
      let actualizados = 0;
      let noEncontrados = 0;

      for (let i = 1; i < data.length; i++) {
        const ref = String(data[i][idxCodigo] || "").trim();
        if (!ref) continue;

        const fileId = index[ref];
        if (fileId) {
          const url = `https://drive.google.com/file/d/${fileId}/view?usp=drive_link`;
          sheet.getRange(i + 1, idxUrlImagen + 1).setValue(url);
          actualizados++;
        } else {
          sheet.getRange(i + 1, idxUrlImagen + 1).setValue("");
          noEncontrados++;
        }
      }

      Logger.log(`✓ URLs generadas: ${actualizados} actualizadas, ${noEncontrados} no encontradas`);

      return {
        success: true,
        actualizados: actualizados,
        noEncontrados: noEncontrados,
        message: `URLs generadas: ${actualizados} actualizadas, ${noEncontrados} no encontradas`
      };
    } catch (error) {
      Logger.log("❌ Error generando URLs de imágenes: " + error.toString());
      return {
        success: false,
        error: error.toString()
      };
    }
  }
