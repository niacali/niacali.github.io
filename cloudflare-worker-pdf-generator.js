export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response("", { 
        status: 204, 
        headers: corsHeaders() 
      });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { 
        status: 405, 
        headers: corsHeaders() 
      });
    }

    try {
      const body = await request.json();
      const API_KEY = "TIENDA_API_2026";

      if (body.key !== API_KEY) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { 
          status: 401, 
          headers: corsHeaders() 
        });
      }

      if (body.action !== "generarPdfPedido") {
        return new Response(JSON.stringify({ error: "Bad Request" }), { 
          status: 400, 
          headers: corsHeaders() 
        });
      }

      const pdfBytes = await buildBasicPdf(body);
      const filename = `Pedido_${body.pedido_id || "pedido"}.pdf`;

      return new Response(pdfBytes, {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`
        }
      });
    } catch (error) {
      console.error("Worker error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders()
      });
    }
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

async function buildBasicPdf(payload) {
  const pedidoId = payload.pedido_id || "N/A";
  const cliente = payload.cliente || {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  const total = Number(payload.total || 0);
  
  // Obtener fecha actual en formato colombiano
  const fecha = new Date().toLocaleDateString('es-CO', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  // Generar tabla de items con fuente monoespaciada
  let itemsTableText = "";
  
  items.forEach((item, idx) => {
    const num = String(idx + 1).padStart(2, ' ');
    const producto = (item.nombre || 'Producto').substring(0, 40).padEnd(40, ' ');
    const cantidad = String(item.cantidad || 1).padStart(4, ' ');
    const precioUnit = String(Math.round(item.precio || 0)).padStart(8, ' ');
    const subtotal = String(Math.round((item.cantidad || 1) * (item.precio || 0))).padStart(8, ' ');
    
    itemsTableText += `(${num}  ${producto}  ${cantidad}  $${precioUnit}  $${subtotal}) Tj\n0 -12 Td\n`;
  });

  // Calcular longitud dinámica del stream
  const streamLength = 900 + itemsTableText.length;

  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>
endobj
4 0 obj
<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> /FC << /Type /Font /Subtype /Type1 /BaseFont /Courier >> >> >>
endobj
5 0 obj
<< /Length ${streamLength} >>
stream
BT
/F2 18 Tf
50 770 Td
(NIA CALI - PEDIDO DE COMPRA) Tj
0 -28 Td
/F1 9 Tf
(Pedido #: ${pedidoId}) Tj
0 -12 Td
(Fecha: ${fecha}) Tj
0 -12 Td
(Cliente: ${cliente.nombre || 'N/A'}) Tj
0 -12 Td
(Telefono: ${cliente.telefono || 'N/A'}) Tj
0 -12 Td
(Ciudad: ${cliente.ciudad || 'N/A'}) Tj
0 -22 Td
/F2 11 Tf
(DETALLE DE PRODUCTOS) Tj
0 -16 Td
/FC 9 Tf
(#   Producto                                   Cant    Precio.    Subtotal) Tj
0 -12 Td
(___________________________________________________________________________________) Tj
0 -12 Td
${itemsTableText}
0 -16 Td
(___________________________________________________________________________________) Tj
0 -16 Td
/F2 13 Tf
(TOTAL: $ ${total.toLocaleString('es-CO')}) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000214 00000 n 
0000000350 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
1200
%%EOF`;

  const encoder = new TextEncoder();
  return encoder.encode(pdfContent);
}