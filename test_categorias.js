// ═══════════════════════════════════════════════════════════════════════
// PRUEBA DE CATEGORÍAS - Ejecutar en consola del navegador
// ═══════════════════════════════════════════════════════════════════════

// Función para probar carga de categorías desde el frontend
async function testFrontendCategorias() {
  console.log("🧪 Probando carga de categorías desde frontend...");

  const API_URL = "https://script.google.com/macros/s/AKfycbzrRc0e5xD9tLPFPsQNgGdfGaHTkJ5uuCLW_ZGZad0I68MBQKtm11yQNkZNOjxFL8SuhQ/exec";
  const API_KEY = "TIENDA_API_2026";

  try {
    // 1. Probar endpoint getCategorias
    console.log("📡 Probando getCategorias...");
    const response1 = await fetch(`${API_URL}?action=getCategorias&key=${API_KEY}`);
    const data1 = await response1.json();
    console.log("✅ getCategorias response:", data1);

    // 2. Probar endpoint getCategoriasAdmin
    console.log("📡 Probando getCategoriasAdmin...");
    const response2 = await fetch(`${API_URL}?action=getCategoriasAdmin&key=${API_KEY}`);
    const data2 = await response2.json();
    console.log("✅ getCategoriasAdmin response:", data2);

    // 3. Probar endpoint testCategorias
    console.log("📡 Probando testCategorias...");
    const response3 = await fetch(`${API_URL}?action=testCategorias&key=${API_KEY}`);
    const data3 = await response3.json();
    console.log("✅ testCategorias response:", data3);

    // 4. Verificar estructura de respuesta
    console.log("🔍 Verificando estructura...");

    if (data1.success && Array.isArray(data1.items)) {
      console.log(`✅ getCategorias: ${data1.items.length} categorías activas`);
      data1.items.forEach(cat => {
        console.log(`  - ${cat.nombre} (${cat.id}): "${cat.icono}"`);
      });
    } else {
      console.error("❌ getCategorias: Estructura inválida", data1);
    }

    if (data2.success && Array.isArray(data2.items)) {
      console.log(`✅ getCategoriasAdmin: ${data2.items.length} categorías totales`);
    } else {
      console.error("❌ getCategoriasAdmin: Estructura inválida", data2);
    }

    if (data3.ok) {
      console.log(`✅ testCategorias: Prueba exitosa - ${data3.categorias_activas} categorías activas`);
    } else {
      console.error("❌ testCategorias: Error en prueba", data3);
    }

  } catch (error) {
    console.error("❌ Error en prueba frontend:", error);
  }
}

// Ejecutar prueba automáticamente
testFrontendCategorias();

// ═══════════════════════════════════════════════════════════════════════
// PRUEBA DE FILTRADO DE PRODUCTOS POR CATEGORÍA
// ═══════════════════════════════════════════════════════════════════════

async function testFiltradoCategorias() {
  console.log("🔍 Probando filtrado de productos por categoría...");

  try {
    // 1. Obtener categorías
    const catResponse = await fetch(`${API_URL}?action=getCategorias&key=${API_KEY}`);
    const catData = await catResponse.json();

    if (!catData.success || !catData.items.length) {
      console.error("❌ No se pudieron obtener categorías");
      return;
    }

    // 2. Obtener productos
    const prodResponse = await fetch(`${API_URL}?action=getProductos&key=${API_KEY}`);
    const prodData = await prodResponse.json();

    if (!prodData.success || !prodData.items.length) {
      console.error("❌ No se pudieron obtener productos");
      return;
    }

    console.log(`📊 Datos: ${catData.items.length} categorías, ${prodData.items.length} productos`);

    // 3. Probar filtrado para cada categoría
    catData.items.forEach(cat => {
      const filtrados = prodData.items.filter(p => {
        const prodCat = String(p.categoria || "").toLowerCase().trim();
        const catNombre = String(cat.nombre || "").toLowerCase().trim();
        const catId = String(cat.id || "").toLowerCase().trim();
        return prodCat === catNombre || prodCat === catId;
      });

      console.log(`📂 ${cat.nombre} (${cat.id}): ${filtrados.length} productos`);
      if (filtrados.length > 0) {
        console.log(`   ✅ Ejemplos: ${filtrados.slice(0, 3).map(p => p.nombre).join(", ")}`);
      }
    });

    // 4. Verificar que todas las categorías tienen productos
    const categoriasSinProductos = catData.items.filter(cat => {
      return !prodData.items.some(p => {
        const prodCat = String(p.categoria || "").toLowerCase().trim();
        const catNombre = String(cat.nombre || "").toLowerCase().trim();
        const catId = String(cat.id || "").toLowerCase().trim();
        return prodCat === catNombre || prodCat === catId;
      });
    });

    if (categoriasSinProductos.length > 0) {
      console.warn("⚠️ Categorías sin productos encontrados:");
      categoriasSinProductos.forEach(cat => {
        console.warn(`   - ${cat.nombre} (${cat.id})`);
      });
    } else {
      console.log("✅ Todas las categorías tienen productos asociados");
    }

  } catch (error) {
    console.error("❌ Error en prueba de filtrado:", error);
  }
}

// Función global para ejecutar todas las pruebas
window.testCompletoCategorias = async () => {
  console.log("🚀 Ejecutando suite completo de pruebas de categorías...");
  await testFrontendCategorias();
  console.log("\n" + "=".repeat(50) + "\n");
  await testFiltradoCategorias();
  console.log("\n🎯 Suite de pruebas completada");
};

// ═══════════════════════════════════════════════════════════════════════
// INSTRUCCIONES DE USO
// ═══════════════════════════════════════════════════════════════════════
/*
1. Abre la consola del navegador (F12 → Console)
2. Copia y pega este código completo
3. Presiona Enter
4. Revisa los resultados en la consola

Funciones disponibles:
- testFrontendCategorias(): Prueba solo los endpoints
- testFiltradoCategorias(): Prueba el filtrado de productos
- testCompletoCategorias(): Ejecuta todas las pruebas

Resultados esperados:
- ✅ getCategorias: categorías activas
- ✅ getCategoriasAdmin: todas las categorías
- ✅ testCategorias: resumen de la prueba
- 📂 [Categoría]: X productos (para cada categoría)
- ✅ Todas las categorías tienen productos asociados

Si hay errores, revisa:
- Que la hoja "categorias" existe en Sheets
- Que tiene las columnas: id, nombre, icono, orden, estado
- Que hay al menos una fila con estado="activo"
- Que los productos tienen el campo 'categoria' correcto
- Que la API key es correcta
- Que el script está desplegado en Apps Script
*/