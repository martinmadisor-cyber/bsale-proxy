// Proxy para Bsale API - Versión mejorada
const cors = require('cors');

const corsOptions = {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'access_token'],
  credentials: true
};

module.exports = async (req, res) => {
  // Aplicar CORS
  cors(corsOptions)(req, res, async () => {
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const { method, url } = req;

    // Manejar peticiones que no son de la API (favicon, raíz, etc.)
    if (!url.startsWith('/api/bsale')) {
      if (url === '/' || url === '/favicon.ico' || url === '/favicon.png') {
        return res.status(200).json({
          message: 'Bsale Proxy API',
          status: 'active',
          usage: 'Use /api/bsale/[endpoint] para acceder a la API de Bsale',
          examples: [
            '/api/bsale/products.json',
            '/api/bsale/clients.json',
            '/api/bsale/documents.json'
          ]
        });
      } else {
        return res.status(404).json({
          error: 'Endpoint no encontrado',
          message: 'Use /api/bsale/[endpoint] para acceder a la API de Bsale'
        });
      }
    }

    try {
      // Limpiar la URL y validar
      let path = url.replace('/api/bsale', '');
      
      // Si está vacío o solo es "/", mostrar ayuda
      if (!path || path === '/') {
        return res.status(200).json({
          message: 'Bsale Proxy API',
          status: 'active',
          endpoints_disponibles: [
            '/api/bsale/products.json - Obtener productos',
            '/api/bsale/clients.json - Obtener clientes', 
            '/api/bsale/documents.json - Obtener documentos',
            '/api/bsale/stocks.json - Obtener stocks'
          ]
        });
      }
      
      // Asegurar que empiece con /
      if (!path.startsWith('/')) path = '/' + path;
      
      // Agregar .json si no lo tiene y no tiene parámetros
      if (!path.endsWith('.json') && !path.includes('?') && !path.includes('=')) {
        path += '.json';
      }
      
      // Validar que no contenga caracteres extraños
      if (path.includes('=') && !path.includes('?')) {
        return res.status(400).json({
          error: 'URL malformada',
          message: 'La URL contiene caracteres inválidos',
          ejemplo_correcto: '/api/bsale/products.json'
        });
      }
      
      const BSALE_ACCESS_TOKEN = process.env.BSALE_ACCESS_TOKEN || "2a7bf9dd3f9594699e5862c6f199d99cfabce557";
      
      console.log('✅ Procesando request válido:', method, path);
      
      // URL completa para Bsale
      const targetUrl = `https://api.bsale.io/v1${path}`;
      console.log('🌐 URL destino:', targetUrl);

      const headers = {
        'access_token': BSALE_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      };

      const fetchOptions = {
        method: method,
        headers: headers
      };

      if (method === 'POST' || method === 'PUT') {
        fetchOptions.body = JSON.stringify(req.body);
      }

      console.log('📡 Haciendo petición a Bsale...');
      const bsaleResponse = await fetch(targetUrl, fetchOptions);
      
      console.log('📊 Respuesta de Bsale:', bsaleResponse.status);

      let responseData;
      const contentType = bsaleResponse.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await bsaleResponse.json();
      } else {
        responseData = await bsaleResponse.text();
      }

      if (!bsaleResponse.ok) {
        console.log('❌ Error de Bsale:', responseData);
        return res.status(bsaleResponse.status).json({
          success: false,
          error: 'Error de la API de Bsale',
          details: responseData,
          status: bsaleResponse.status,
          url_solicitada: targetUrl
        });
      }

      console.log('✅ Respuesta exitosa de Bsale');
      res.status(200).json({
        success: true,
        data: responseData,
        status: bsaleResponse.status,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('💥 Error en el proxy:', error);
      
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
};
