const cors = require('cors');

const corsOptions = {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'access_token'],
  credentials: true
};

module.exports = async (req, res) => {
  cors(corsOptions)(req, res, async () => {
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const { method, url } = req;

    if (!url.startsWith('/api/bsale')) {
      if (url === '/' || url === '/favicon.ico' || url === '/favicon.png') {
        return res.status(200).json({
          message: 'Bsale Proxy API',
          status: 'active',
          usage: 'Use /api/bsale/[endpoint] para acceder a la API de Bsale'
        });
      }
    }

    try {
      let path = url.replace('/api/bsale', '');
      if (!path.startsWith('/')) path = '/' + path;
      if (!path.endsWith('.json') && !path.includes('?')) {
        path += '.json';
      }
      
      const BSALE_ACCESS_TOKEN = process.env.BSALE_ACCESS_TOKEN || "2a7bf9dd3f9594699e5862c6f199d99cfabce557";
      
      const targetUrl = `https://api.bsale.io/v1${path}`;

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

      const bsaleResponse = await fetch(targetUrl, fetchOptions);
      let responseData;
      
      const contentType = bsaleResponse.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        responseData = await bsaleResponse.json();
      } else {
        responseData = await bsaleResponse.text();
      }

      if (!bsaleResponse.ok) {
        return res.status(bsaleResponse.status).json({
          success: false,
          error: 'Error de la API de Bsale',
          details: responseData,
          status: bsaleResponse.status
        });
      }

      res.status(200).json({
        success: true,
        data: responseData,
        status: bsaleResponse.status,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
};
