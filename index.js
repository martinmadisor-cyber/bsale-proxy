// Primero importamos la librería CORS que ya tienes instalada
const cors = require('cors');

// Configuramos CORS para permitir peticiones desde ciertos dominios
const corsOptions = {
  // Aquí defines qué dominios pueden usar tu proxy
  origin: ['http://localhost:3000', 'https://tu-dominio.com'], 
  // Qué métodos HTTP permitimos (GET para obtener datos, POST para crear, etc.)
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  // Qué headers pueden enviar las peticiones
  allowedHeaders: ['Content-Type', 'Authorization', 'access_token'],
  // Permitir cookies si es necesario
  credentials: true
};

// Esta es la función principal que maneja todas las peticiones
module.exports = async (req, res) => {
  // Aplicamos la configuración de CORS a esta petición
  cors(corsOptions)(req, res, async () => {
    
    // Si es una petición OPTIONS (pregunta previa del navegador), la respondemos inmediatamente
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    try {
      // Extraemos información de la petición que nos llegó
      const { method, url } = req;
      
      // Limpiamos la URL para enviarla a Bsale
      // Si llega "/api/bsale/products", enviamos "/products" a Bsale
      const path = url.replace('/api/bsale', '');
      
      // Obtenemos el token de Bsale desde las variables de entorno
      const BSALE_ACCESS_TOKEN = process.env.BSALE_ACCESS_TOKEN;
      
      // Si no hay token, devolvemos un error
      if (!BSALE_ACCESS_TOKEN) {
        return res.status(500).json({
          error: 'Token de acceso de Bsale no configurado',
          message: 'Configure BSALE_ACCESS_TOKEN en las variables de entorno'
        });
      }

      // Construimos la URL completa para enviar a Bsale
      const BSALE_API_BASE = 'https://api.bsale.io/v1';
      const targetUrl = `${BSALE_API_BASE}${path}`;

      // Configuramos los headers que necesita Bsale
      const headers = {
        'Content-Type': 'application/json',
        'access_token': BSALE_ACCESS_TOKEN,
        'User-Agent': 'Bsale-Proxy/1.0.0'
      };

      // Preparamos las opciones para la petición a Bsale
      const fetchOptions = {
        method: method,
        headers: headers
      };

      // Si es una petición POST o PUT, incluimos el cuerpo de la petición
      if (method === 'POST' || method === 'PUT') {
        fetchOptions.body = JSON.stringify(req.body);
      }

      // Mostramos en consola qué estamos haciendo (útil para debugging)
      console.log(`Reenviando petición ${method} a: ${targetUrl}`);

      // Hacemos la petición real a Bsale
      const bsaleResponse = await fetch(targetUrl, fetchOptions);
      const responseData = await bsaleResponse.json();

      // Mostramos el resultado en consola
      console.log(`Respuesta de Bsale: ${bsaleResponse.status}`);

      // Devolvemos la respuesta a quien nos consultó
      res.status(bsaleResponse.status).json({
        success: bsaleResponse.ok,
        data: responseData,
        status: bsaleResponse.status,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      // Si algo sale mal, devolvemos un error detallado
      console.error('Error en el proxy de Bsale:', error);
      
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
};
