// ============================================
// CONFIGURACIÓN DE API (Apps Script)
// ============================================
const USE_API = true; // Cambia a false para usar solo localStorage/products.json
const API_BASE = 'https://script.google.com/macros/s/AKfycbw33kNIJoErEi79YliIqsihTfVLFcvLs-1pXSmvIkTgtUMzZyY4fQWOHBWuROO9tlMHfw/exec'; // URL del deploy con CORS workaround
const API_KEY = 'nia2026_api_key'; // Debe coincidir con Code.gs

async function apiCall(path, { method = 'GET', body = null, includeApiKey = false } = {}) {
    // Apps Script solo soporta GET y POST bien con CORS
    // Simulamos PUT/DELETE con POST + parámetro _method
    let actualMethod = method;
    let params = `path=${path}${includeApiKey ? `&apiKey=${API_KEY}` : ''}`;
    
    if (method === 'PUT' || method === 'DELETE') {
        params += `&_method=${method}`;
        actualMethod = 'POST';
    }
    
    const url = `${API_BASE}?${params}`;
    const opts = {
        method: actualMethod
    };
    
    // Solo agregar headers y body si es POST (evita preflight CORS en GET)
    if (actualMethod === 'POST') {
        opts.headers = { 'Content-Type': 'application/json' };
        if (body) {
            opts.body = JSON.stringify(body);
        }
    }

    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
        const msg = data.error || `Error API (${res.status})`;
        throw new Error(msg);
    }
    return data;
}

// ============================================
// SISTEMA DE GESTIÓN DE DATOS - INVENTRACKER
// ============================================

class InventoryManager {
    constructor() {
        this.products = [];
        this.categories = [];
        this.cart = this.loadCart();
        this.orders = this.loadOrders();
        this.isInitialized = false;
    }

    // Inicializar la aplicación
    async init() {
        if (this.isInitialized) return; // Evitar inicializaciones múltiples
        await this.loadProducts();
        this.isInitialized = true;
    }

    // Cargar productos desde API, localStorage o JSON
    async loadProducts() {
        try {
            console.log('🔄 Intentando cargar productos...');

            // Preferir API si está activada (siempre forzar recarga desde API)
            if (USE_API) {
                try {
                    console.log('🌐 Conectando con Google Sheets...');
                    await this.loadFromAPI();
                    console.log('✅ Datos cargados desde API (frescas)');
                    return;
                } catch (apiError) {
                    console.error('❌ Error desde API:', apiError.message);
                    console.warn('⚠️ Intentando usar caché local...');
                    // Fallback a localStorage
                    const localData = localStorage.getItem('productsData');
                    if (localData) {
                        console.log('📦 Usando datos cacheados en localStorage');
                        const data = JSON.parse(localData);
                        this.products = data.products || [];
                        this.categories = data.categories || [];
                        return;
                    }
                }
            }

            // Si API está desactivada, intentar localStorage primero
            const localData = localStorage.getItem('productsData');
            if (localData) {
                console.log('📦 Datos encontrados en localStorage');
                const data = JSON.parse(localData);
                this.products = data.products || [];
                this.categories = data.categories || [];
            } else {
                console.warn('⚠️ No hay datos en caché y API está desactivada');
                console.log('💡 Activa USE_API = true o ejecuta la app con API habilitada al menos una vez');
            }

            console.log('✅ Datos cargados correctamente:', {
                categorias: this.categories.length,
                productos: this.products.length
            });
        } catch (error) {
            console.error('❌ Error cargando productos:', error);
            this.products = [];
            this.categories = [];
        }
    }

    // Cargar desde API
    async loadFromAPI() {
        const [productos, categorias] = await Promise.all([
            apiCall('productos', { method: 'GET', includeApiKey: false }),
            apiCall('categorias', { method: 'GET', includeApiKey: false })
        ]);
        
        // Procesar imágenes para que funcionen correctamente
        this.products = (productos || []).map(p => {
            let imageUrl = '';
            const originalImage = p.image || '';
            
            console.log(`🔍 Procesando: ${p.name}, imagen original: "${originalImage}"`);
            
            if (originalImage && originalImage.trim() !== '') {
                // Si ya es una URL completa de Drive, convertirla a URL de visualización directa
                if (originalImage.includes('drive.google.com/file/d/')) {
                    // Extraer el ID del archivo: /d/{ID}/view o /d/{ID}
                    const match = originalImage.match(/\/d\/([a-zA-Z0-9_\-]+)/);
                    if (match && match[1]) {
                        const fileId = match[1].trim();
                        // Usar URL directa de Drive que funciona públicamente
                        imageUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
                        console.log(`✅ URL Drive convertida para ${p.name}: ID=${fileId}`);
                    } else {
                        imageUrl = originalImage;
                        console.warn(`⚠️ No se pudo extraer ID de Drive para ${p.name}`);
                    }
                } else if (originalImage.startsWith('http://') || originalImage.startsWith('https://')) {
                    // URL externa (ej: Unsplash, etc.)
                    imageUrl = originalImage;
                    console.log(`📌 Usando URL directa para ${p.name}`);
                } else {
                    // Asumir que es un código contable o nombre de archivo
                    // Usar endpoint del backend para buscar en la carpeta de Drive
                    imageUrl = `${API_BASE}?path=imagen/${encodeURIComponent(originalImage)}`;
                    console.log(`🔧 Usando código contable para ${p.name}: ${originalImage}`);
                }
            } else if (p.contabilidad && p.contabilidad.trim() !== '') {
                // Fallback: intentar construir desde código contable
                imageUrl = `${API_BASE}?path=imagen/${encodeURIComponent(p.contabilidad)}`;
                console.log(`🔧 Fallback a código contable para ${p.name}: ${p.contabilidad}`);
            } else {
                // Imagen placeholder por defecto
                imageUrl = 'https://via.placeholder.com/400x400?text=Sin+Imagen';
                console.warn(`⚠️ No se encontró imagen para ${p.name}, usando placeholder`);
            }
            
            return {
                ...p,
                image: imageUrl
            };
        });
        this.categories = categorias || [];
        this.saveProductsData(); // cache local
    }

    // Guardar productos en localStorage
    saveProductsData() {
        const data = {
            products: this.products,
            categories: this.categories
        };
        localStorage.setItem('productsData', JSON.stringify(data));
    }

    // ============================================
    // GESTIÓN DE PRODUCTOS
    // ============================================

    getProducts() {
        return this.products;
    }

    getProductById(id) {
        return this.products.find(p => p.id === parseInt(id));
    }

    getProductsByCategory(categoryId) {
        return this.products.filter(p => p.category === categoryId);
    }

    async addProduct(product) {
        if (USE_API) {
            const result = await apiCall('productos', { method: 'POST', body: product, includeApiKey: true });
            const newProduct = { ...product, id: result.id };
            this.products.push(newProduct);
            this.saveProductsData();
            return newProduct;
        }

        const newId = Math.max(...this.products.map(p => p.id), 0) + 1;
        const newProduct = { ...product, id: newId };
        this.products.push(newProduct);
        this.saveProductsData();
        return newProduct;
    }

    async updateProduct(id, updates) {
        if (USE_API) {
            await apiCall(`productos/${id}`, { method: 'PUT', body: updates, includeApiKey: true });
        }

        const index = this.products.findIndex(p => p.id === parseInt(id));
        if (index !== -1) {
            this.products[index] = { ...this.products[index], ...updates };
            this.saveProductsData();
            return this.products[index];
        }
        return null;
    }

    async deleteProduct(id) {
        if (USE_API) {
            await apiCall(`productos/${id}`, { method: 'DELETE', includeApiKey: true });
        }

        const index = this.products.findIndex(p => p.id === parseInt(id));
        if (index !== -1) {
            this.products.splice(index, 1);
            this.saveProductsData();
            return true;
        }
        return false;
    }

    // ============================================
    // GESTIÓN DE CATEGORÍAS
    // ============================================

    getCategories() {
        return this.categories;
    }

    getCategoryById(id) {
        return this.categories.find(c => c.id === id);
    }

    addCategory(category) {
        this.categories.push(category);
        this.saveProductsData();
    }

    // ============================================
    // GESTIÓN DEL CARRITO
    // ============================================

    loadCart() {
        const cart = localStorage.getItem('cart');
        return cart ? JSON.parse(cart) : [];
    }

    saveCart() {
        localStorage.setItem('cart', JSON.stringify(this.cart));
    }

    getCart() {
        return this.cart;
    }

    addToCart(productId, quantity = 1) {
        const product = this.getProductById(productId);
        if (!product) return false;

        // Validar que el producto esté disponible
        if (product.estado !== 'DISPONIBLE') {
            console.warn('⚠️ Producto no disponible:', product.name);
            return false;
        }

        const existingItem = this.cart.find(item => item.productId === productId);
        
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            this.cart.push({
                productId: productId,
                quantity: quantity,
                addedAt: new Date().toISOString()
            });
        }
        
        this.saveCart();
        return true;
    }

    updateCartItemQuantity(productId, quantity) {
        const item = this.cart.find(item => item.productId === productId);
        if (item) {
            if (quantity <= 0) {
                this.removeFromCart(productId);
            } else {
                item.quantity = quantity;
                this.saveCart();
            }
            return true;
        }
        return false;
    }

    removeFromCart(productId) {
        this.cart = this.cart.filter(item => item.productId !== productId);
        this.saveCart();
    }

    clearCart() {
        this.cart = [];
        this.saveCart();
    }

    getCartWithDetails() {
        return this.cart.map(item => {
            const product = this.getProductById(item.productId);
            return {
                ...item,
                product: product,
                subtotal: product ? product.price * item.quantity : 0
            };
        });
    }

    getCartTotal() {
        const items = this.getCartWithDetails();
        return items.reduce((total, item) => total + item.subtotal, 0);
    }

    getCartItemCount() {
        return this.cart.reduce((total, item) => total + item.quantity, 0);
    }

    // ============================================
    // GESTIÓN DE PEDIDOS
    // ============================================

    loadOrders() {
        const orders = localStorage.getItem('orders');
        return orders ? JSON.parse(orders) : [];
    }

    saveOrders() {
        localStorage.setItem('orders', JSON.stringify(this.orders));
    }

    async createOrder(customerInfo = {}) {
        const items = this.getCartWithDetails();
        const total = this.getCartTotal();

        if (!items.length) {
            throw new Error('No hay productos en el carrito');
        }

        // Validar datos mínimos del cliente
        const nombre = customerInfo.nombre || customerInfo.name;
        const ciudad = customerInfo.ciudad || customerInfo.city;
        if (!nombre || !ciudad) {
            throw new Error('Faltan datos del cliente (nombre y ciudad)');
        }

        if (USE_API) {
            // Enviar pedido a Apps Script
            const payload = {
                items: items.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.product?.price || 0,
                    name: item.product?.name || ''
                })),
                total: total,
                cliente: nombre,
                ciudad: ciudad,
                contacto: customerInfo.contacto || customerInfo.telefono || customerInfo.contact || ''
            };

            const result = await apiCall('pedidos', { method: 'POST', body: payload, includeApiKey: true });

            const order = {
                orderNumber: result.id || this.generateOrderNumber(),
                items,
                total,
                customerInfo: { ...customerInfo, nombre, ciudad },
                createdAt: result.createdAt || new Date().toISOString(),
                status: 'pending'
            };

            this.orders.push(order);
            this.saveOrders();
            this.clearCart();
            return order;
        }

        // Fallback local
        const orderNumber = this.generateOrderNumber();
        const order = {
            orderNumber: orderNumber,
            items,
            total,
            customerInfo: { ...customerInfo, nombre, ciudad },
            createdAt: new Date().toISOString(),
            status: 'pending'
        };
        
        this.orders.push(order);
        this.saveOrders();
        this.clearCart();
        
        return order;
    }

    generateOrderNumber() {
        const randomNum = Math.floor(10000000 + Math.random() * 89999999);
        return String(randomNum).padStart(8, '0');
    }

    getOrders() {
        return this.orders;
    }

    getOrderByNumber(orderNumber) {
        return this.orders.find(o => o.orderNumber === orderNumber);
    }

    // ============================================
    // UTILIDADES
    // ============================================

    formatPrice(price) {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(price);
    }

    formatDate(dateString) {
        return new Intl.DateTimeFormat('es-CO', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(dateString));
    }
}

// ============================================
// UTILIDADES DE INTERFAZ
// ============================================

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg text-white transform transition-all duration-300 ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}
function updateCartBadge() {
    if (!window.inventoryManager) return;
    const badge = document.getElementById('cart-badge');
    if (badge) {
        const count = window.inventoryManager.getCartItemCount();
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
}

// Función helper para esperar a que el inventoryManager esté inicializado
async function ensureInventoryManagerReady() {
    if (!window.inventoryManager) {
        // Esperar a que se cree
        let attempts = 0;
        while (!window.inventoryManager && attempts < 50) {
            await new Promise(r => setTimeout(r, 50));
            attempts++;
        }
    }
    if (window.inventoryManager && !window.inventoryManager.isInitialized) {
        await window.inventoryManager.init();
    }
    return window.inventoryManager;
}

// Inicializar el gestor global
const inventoryManager = new InventoryManager();
window.inventoryManager = inventoryManager;

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InventoryManager;
}
