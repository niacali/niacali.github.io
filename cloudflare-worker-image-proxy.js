/**
 * CLOUDFLARE WORKER - Proxy de Imágenes de Google Drive
 * Producción Ready - Copy & Paste
 * Proxy: https://tienda-image-proxy.pedidosnia-cali.workers.dev
 * 
 * Características:
 * ✅ Proxy CORS para Google Drive
 * ✅ CDN Global de Cloudflare
 * ✅ Caché de 30 días
 * ✅ Retry automático (3 intentos)
 * ✅ SVG error fallback
 * ✅ Headers optimizados
 * ✅ Métricas de caché (X-Cache header)
 */

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleImageRequest(request, env, ctx);
    } catch (error) {
      console.error(`Unhandled error: ${error.message}`);
      return new Response(getSvgError('Internal Server Error'), {
        status: 500,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        }
      });
    }
  }
};

/**
 * Manejador principal de solicitudes
 */
async function handleImageRequest(request, env, ctx) {
  // Solo aceptar GET
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(request.url);
  const fileId = url.searchParams.get('fileId');
  const key = url.searchParams.get('key');

  // ═══════════════════════════════════════════════
  // 1. VALIDACIONES
  // ═══════════════════════════════════════════════

  const API_KEY = env.API_KEY || "TIENDA_API_2026";

  if (key !== API_KEY) {
    console.warn(`Invalid API key: ${key}`);
    return new Response('Unauthorized - Invalid API key', { status: 401 });
  }

  if (!fileId || !fileId.trim()) {
    return new Response('Bad Request - Missing fileId parameter', { status: 400 });
  }

  // Validar formato de fileId (Google Drive IDs tienen ~25+ caracteres alfanuméricos)
  if (!isValidFileId(fileId)) {
    return new Response('Bad Request - Invalid fileId format', { status: 400 });
  }

  console.log(`Request for fileId: ${fileId}`);

  // ═══════════════════════════════════════════════
  // 2. INTENTAR OBTENER DEL CACHÉ
  // ═══════════════════════════════════════════════

  const cacheKey = new Request(`https://cache.internal/${fileId}`, {
    method: 'GET'
  });

  const cache = caches.default;
  let response = await cache.match(cacheKey);

  if (response) {
    console.log(`[CACHE HIT] ${fileId}`);
    
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('X-Cache', 'HIT');
    newResponse.headers.set('X-Cache-Source', 'Cloudflare');
    newResponse.headers.append('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
    newResponse.headers.set('Cross-Origin-Embedder-Policy', 'unsafe-none');
    
    return newResponse;
  }

  console.log(`[CACHE MISS] ${fileId} - Fetching from Google Drive`);

  // ═══════════════════════════════════════════════
  // 3. FETCH DE GOOGLE DRIVE (CON RETRY)
  // ═══════════════════════════════════════════════

  try {
    response = await fetchWithRetry(fileId, 3);

    if (!response.ok) {
      console.error(`Drive returned status ${response.status}`);
      return new Response(
        getSvgError(`Google Drive error ${response.status}`),
        {
          status: response.status,
          headers: {
            'Content-Type': 'image/svg+xml',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache'
          }
        }
      );
    }

    // ═══════════════════════════════════════════════
    // 4. CREAR RESPUESTA CON HEADERS OPTIMIZADOS
    // ═══════════════════════════════════════════════

    const newResponse = new Response(response.body, {
      status: 200,
      headers: new Headers(response.headers)
    });

    // Headers de caché
    newResponse.headers.set('Cache-Control', 'public, max-age=2592000, immutable');
    newResponse.headers.set('Expires', new Date(Date.now() + 2592000000).toUTCString());

    // Headers de seguridad
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    newResponse.headers.set('Access-Control-Expose-Headers', 'Content-Type, Content-Length');
    newResponse.headers.set('Access-Control-Allow-Credentials', 'true');
    
    // Headers para evitar SameSite issues
    newResponse.headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
    newResponse.headers.set('Cross-Origin-Embedder-Policy', 'unsafe-none');

    // Headers informativos
    newResponse.headers.set('X-Cache', 'MISS');
    newResponse.headers.set('X-Cache-Source', 'Google Drive');
    newResponse.headers.set('X-Powered-By', 'Cloudflare Workers');

    // Contenttype
    if (!newResponse.headers.get('Content-Type')) {
      newResponse.headers.set('Content-Type', 'image/jpeg');
    }

    // Optimización de Cloudflare
    newResponse.headers.set('cf-cache-status', 'CACHE');

    // ═══════════════════════════════════════════════
    // 5. CACHEAR EN CLOUDFLARE
    // ═══════════════════════════════════════════════

    ctx.waitUntil(cache.put(cacheKey, newResponse.clone()));

    console.log(`[CACHED] ${fileId} - TTL: 30 days`);

    return newResponse;

  } catch (error) {
    console.error(`Fetch error: ${error.message}`);

    return new Response(
      getSvgError(error.message || 'Failed to fetch image'),
      {
        status: 503,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store'
        }
      }
    );
  }
}

/**
 * Fetch con retry automático
 * @param {string} fileId - Google Drive file ID
 * @param {number} maxAttempts - Número máximo de intentos
 * @returns {Response}
 */
async function fetchWithRetry(fileId, maxAttempts = 3) {
  const driveUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[Attempt ${attempt}/${maxAttempts}] Fetching: ${fileId}`);

      const response = await fetch(driveUrl, {
        method: 'GET',
        cf: {
          // Configuración de Cloudflare
          cacheTtl: 2592000, // 30 días
          cacheEverything: true,
          mirage: true, // Optimización de imágenes
          minify: {
            javascript: false,
            css: false,
            html: false
          },
          // Retry configurado a nivel de Cloudflare
          timeout: 10000 // 10 segundos
        }
      });

      if (response.ok) {
        console.log(`[Success] ${fileId} (attempt ${attempt})`);
        return response;
      }

      console.warn(`[Failed] ${fileId} - Status ${response.status} (attempt ${attempt})`);

      // Retry logic
      if (attempt < maxAttempts) {
        const delayMs = 1000 * attempt; // Delay exponencial: 1s, 2s, 3s
        console.log(`[Retry] Waiting ${delayMs}ms before next attempt...`);
        await sleep(delayMs);
      }

    } catch (error) {
      console.warn(
        `[Exception] ${fileId} - ${error.message} (attempt ${attempt})`
      );

      if (attempt < maxAttempts) {
        const delayMs = 1000 * attempt;
        console.log(`[Retry] Waiting ${delayMs}ms before next attempt...`);
        await sleep(delayMs);
      }
    }
  }

  throw new Error(
    `Failed to fetch image after ${maxAttempts} attempts. FileID: ${fileId}`
  );
}

/**
 * Helper: Sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper: Validar formato de FileID de Google Drive
 */
function isValidFileId(fileId) {
  // Google Drive IDs: ~25-100 caracteres, alfanuméricos, guiones, guiones bajos
  const googleDriveIdRegex = /^[a-zA-Z0-9_-]{20,}$/;
  return googleDriveIdRegex.test(fileId);
}

/**
 * Generar SVG de error
 */
function getSvgError(message) {
  const safeMessage = escapeHtml(message.substring(0, 50));

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f5f5f5;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#e0e0e0;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="400" height="300" fill="url(#grad)"/>
  
  <!-- Error Icon -->
  <circle cx="200" cy="120" r="40" fill="#ffcccc" opacity="0.3"/>
  <circle cx="200" cy="120" r="30" fill="none" stroke="#ff6b6b" stroke-width="2"/>
  <text x="200" y="130" font-size="48" fill="#ff6b6b" text-anchor="middle" font-weight="bold">⚠</text>
  
  <!-- Error Message -->
  <text x="200" y="200" font-size="16" fill="#666" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold">
    Image Error
  </text>
  <text x="200" y="230" font-size="11" fill="#999" text-anchor="middle" font-family="Arial, sans-serif">
    ${safeMessage}
  </text>
  
  <!-- Powered by -->
  <text x="200" y="280" font-size="10" fill="#ccc" text-anchor="middle" font-family="Arial, sans-serif">
    Cloudflare Workers
  </text>
</svg>`;
}

/**
 * Escape HTML characters
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Handler para OPTIONS (CORS preflight)
 */
export async function handleOptions(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      }
    });
  }
  return new Response('Method not allowed', { status: 405 });
}

/**
 * STATISTICS & LOGGING
 * 
 * Para monitoreo, agregar a wrangler.toml:
 * [env.production]
 * routes = [
 *   { pattern = "images.tu-dominio.com/*", zone_name = "tu-dominio.com" }
 * ]
 * 
 * Luego en Cloudflare Dashboard:
 * Workers > Logs > Ver todos los logs
 * 
 * Métricas disponibles:
 * - Cache Hit Ratio (X-Cache header)
 * - Response Time
 * - Error Rate
 * - Request Count
 */
