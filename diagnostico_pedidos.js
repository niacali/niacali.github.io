/**
 * SCRIPT DE DIAGNÓSTICO - GESTIÓN DE PEDIDOS
 * ============================================
 * 
 * Ejecutar en la consola del navegador (F12) en admin.html
 * para verificar que todo esté funcionando correctamente.
 */

console.log("🔍 INICIANDO DIAGNÓSTICO DE PEDIDOS...\n");

// ═════════════════════════════════════════════════════════════════
// 1. Verificar que las funciones estén disponibles globalmente
// ═════════════════════════════════════════════════════════════════

console.log("📋 FUNCIONES GLOBALES DISPONIBLES:");
console.log("─────────────────────────────────");

const funcionesRequeridas = [
  'refrescarPedidos',
  'verDetallePedido',
  'cerrarModalDetallePedido',
  'guardarCambioPedido',
  'imprimirPedido',
  'imprimirPedidoActual'
];

funcionesRequeridas.forEach(func => {
  const disponible = typeof window[func] === 'function';
  const emoji = disponible ? '✅' : '❌';
  console.log(`${emoji} window.${func}: ${disponible ? 'Disponible' : 'NO DISPONIBLE'}`);
});

// ═════════════════════════════════════════════════════════════════
// 2. Verificar datos de pedidos
// ═════════════════════════════════════════════════════════════════

console.log("\n📦 DATOS DE PEDIDOS:");
console.log("───────────────────");

if (typeof pedidosAdmin !== 'undefined') {
  console.log(`✅ pedidosAdmin disponible`);
  console.log(`   Cantidad de pedidos: ${pedidosAdmin.length}`);
  
  if (pedidosAdmin.length > 0) {
    console.log(`   Primer pedido:`, pedidosAdmin[0]);
  } else {
    console.log("   ⚠️ No hay pedidos cargados");
  }
} else {
  console.log("❌ pedidosAdmin NO está definido");
}

// ═════════════════════════════════════════════════════════════════
// 3. Verificar API_URL
// ═════════════════════════════════════════════════════════════════

console.log("\n🔗 CONFIGURACIÓN DE API:");
console.log("───────────────────────");

if (typeof API_URL !== 'undefined') {
  console.log(`✅ API_URL definida:`);
  console.log(`   ${API_URL}`);
} else {
  console.log("❌ API_URL NO está definida");
}

if (typeof API_KEY !== 'undefined') {
  console.log(`✅ API_KEY definida: ${API_KEY}`);
} else {
  console.log("❌ API_KEY NO está definida");
}

// ═════════════════════════════════════════════════════════════════
// 4. Verificar modal
// ═════════════════════════════════════════════════════════════════

console.log("\n🎨 ELEMENTOS DEL DOM:");
console.log("────────────────────");

const elementos = [
  'listaPedidos',
  'modalDetallePedido',
  'pedidoId',
  'pedidoCliente',
  'tablaItemsPedido',
  'selectEstado'
];

elementos.forEach(id => {
  const elemento = document.getElementById(id);
  const disponible = elemento !== null;
  const emoji = disponible ? '✅' : '❌';
  console.log(`${emoji} #${id}: ${disponible ? 'Existe' : 'NO EXISTE'}`);
});

// ═════════════════════════════════════════════════════════════════
// 5. Probar cargar pedidos
// ═════════════════════════════════════════════════════════════════

console.log("\n🧪 PRUEBA DE CARGA:");
console.log("──────────────────");

console.log("Ejecutando: cargarPedidosAdmin()");
if (typeof cargarPedidosAdmin === 'function') {
  console.log("✅ Función disponible");
  console.log("   Ejecutando...\n");
  
  cargarPedidosAdmin().then(() => {
    console.log("\n✅ Pedidos cargados exitosamente");
    console.log(`   Total: ${pedidosAdmin.length}`);
  }).catch(err => {
    console.error("\n❌ Error al cargar pedidos:", err);
  });
} else {
  console.log("❌ cargarPedidosAdmin NO está disponible");
}

// ═════════════════════════════════════════════════════════════════
// 6. Resumen
// ═════════════════════════════════════════════════════════════════

console.log("\n═════════════════════════════════════════════════════");
console.log("📊 RESUMEN");
console.log("═════════════════════════════════════════════════════");
console.log("\n✅ Si ves esto, el diagnóstico se completó");
console.log("✅ Verifica los ✅ y ❌ arriba para ver el estado");
console.log("\n💡 PRÓXIMOS PASOS:");
console.log("   1. Si todos están ✅, prueba hacer clic en 'Ver Detalle'");
console.log("   2. Si hay ❌, revisa la consola para errores");
console.log("   3. Abre DevTools (F12) → Pestaña Network → Refrescar");
console.log("   4. Busca peticiones a getPedidos y getPedidoDetalle");
console.log("═════════════════════════════════════════════════════\n");
