// api/products.js
export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Manejar preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { token, action } = req.query;
    const { method } = req;

    if (!token) {
      return res.status(400).json({ error: 'Token BSale requerido' });
    }

    const bsaleUrl = 'https://api.bsale.io/v1';
    
    if (method === 'GET') {
      // Obtener productos de BSale
      const response = await fetch(`${bsaleUrl}/products.json?limit=50`, {
        headers: {
          'access_token': token,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`BSale API error: ${response.status}`);
      }

      const data = await response.json();
      res.status(200).json(data);
    } else if (method === 'POST') {
      // Crear producto en BSale
      const productData = req.body;
      const response = await fetch(`${bsaleUrl}/products.json`, {
        method: 'POST',
        headers: {
          'access_token': token,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(productData)
      });

      if (!response.ok) {
        throw new Error(`BSale API error: ${response.status}`);
      }

      const data = await response.json();
      res.status(200).json(data);
    } else {
      res.status(405).json({ error: 'Método no permitido' });
    }
  } catch (error) {
    console.error('Error en proxy BSale:', error);
    res.status(500).json({ 
      error: 'Error en servidor proxy', 
      details: error.message 
    });
  }
}
