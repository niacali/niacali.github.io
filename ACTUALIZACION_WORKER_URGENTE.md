# 🚨 ACTUALIZACIÓN URGENTE - Cloudflare Worker

## ❌ Problema Detectado

**Error:** `ERR_BLOCKED_BY_RESPONSE.NotSameSite`

Las imágenes se bloquean porque el Worker no envía los headers correctos para cross-origin requests.

---

## ✅ Solución

### **PASO 1: Actualizar el Cloudflare Worker**

1. Ve a: https://dash.cloudflare.com/
2. Click en **Workers & Pages**
3. Selecciona: `tienda-image-proxy`
4. Click en **Edit Code**
5. **Reemplaza TODO el código** con el contenido del archivo:
   ```
   cloudflare-worker-image-proxy.js
   ```

### **PASO 2: Cambios Críticos en el Worker**

Busca estas secciones y asegúrate que contengan:

#### A) En la función `handleImageRequest()` - Línea ~88:
```javascript
// Headers de seguridad
newResponse.headers.set('Access-Control-Allow-Origin', '*');
newResponse.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
newResponse.headers.set('Access-Control-Expose-Headers', 'Content-Type, Content-Length');
newResponse.headers.set('Access-Control-Allow-Credentials', 'true');

// Headers para evitar SameSite issues ← NUEVO
newResponse.headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
newResponse.headers.set('Cross-Origin-Embedder-Policy', 'unsafe-none');
```

#### B) En el Cache HIT - Línea ~78:
```javascript
const newResponse = new Response(response.body, response);
newResponse.headers.set('X-Cache', 'HIT');
newResponse.headers.set('X-Cache-Source', 'Cloudflare');
newResponse.headers.append('Access-Control-Allow-Origin', '*');
newResponse.headers.set('Cross-Origin-Resource-Policy', 'cross-origin'); // ← NUEVO
newResponse.headers.set('Cross-Origin-Embedder-Policy', 'unsafe-none');  // ← NUEVO
```

### **PASO 3: Desplegar**

1. Click en **Save and Deploy**
2. Espera ~30 segundos
3. Verifica que dice: "✓ Deployed"

---

## 🧪 VERIFICACIÓN

Abre la consola del navegador (F12) y ejecuta:

```javascript
fetch('https://tienda-image-proxy.pedidosnia-cali.workers.dev/?fileId=1lAEzoFGExGr5bbs443gzAsp9zqSEUYzU&key=TIENDA_API_2026')
  .then(r => {
    console.log('Status:', r.status);
    console.log('CORS:', r.headers.get('Access-Control-Allow-Origin'));
    console.log('CORP:', r.headers.get('Cross-Origin-Resource-Policy'));
    console.log('COEP:', r.headers.get('Cross-Origin-Embedder-Policy'));
  });
```

**Resultado esperado:**
```
Status: 200
CORS: *
CORP: cross-origin
COEP: unsafe-none
```

---

## 📝 Cambios en Frontend (YA APLICADOS)

✅ `app.js` actualizado
✅ Carga directa sin precarga (evita doble request)
✅ Fallback SVG automático
✅ Eliminado retry innecesario

---

## ⚡ Resultado Final

- ✅ Imágenes cargan **instantáneamente**
- ✅ No más errores `NotSameSite`
- ✅ Fallback visual si falla
- ✅ Performance óptima

---

## 🆘 Si Persiste el Error

### Opción A: Limpiar caché del Worker
```bash
# En Cloudflare Dashboard
Workers > tienda-image-proxy > Caching > Purge Cache
```

### Opción B: Usar URL directa de Drive (Rollback)
```javascript
// En app.js, comentar línea 97-99:
// const proxyUrl = convertirDriveUrlAProxy(p.imagen);

// Y usar:
data-src="${p.imagen}"
```

---

## 📊 Monitoreo

Después de actualizar, verifica:

1. **Network Tab (F12)**
   - Domain: `tienda-image-proxy.pedidosnia-cali.workers.dev`
   - Status: `200 OK`
   - Sin errores rojos

2. **Console Tab (F12)**
   - Logs: "Producto: XXX"
   - Sin errores `ERR_BLOCKED_BY_RESPONSE`

3. **Imágenes**
   - Cargan en <2 segundos primera vez
   - <100ms en caché

---

**Última actualización:** 2026-01-29  
**Archivo Worker actualizado:** `cloudflare-worker-image-proxy.js`  
**Archivo Frontend actualizado:** `app.js`
