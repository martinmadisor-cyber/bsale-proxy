// api/clients.js
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
    const { token, code } = req.query;
    const { method } = req;

    if (!token) {
      return res.status(400).json({ error: 'Token BSale requerido' });
    }

    const bsaleUrl = 'https://api.bsale.io/v1';
    
    if (method === 'GET') {
      // Obtener clientes de BSale
      let url = `${bsaleUrl}/clients.json?limit=50`;
      
      // Si se proporciona código, buscar cliente específico
      if (code) {
        url = `${bsaleUrl}/clients.json?code=${encodeURIComponent(code)}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`BSale API error: ${response.status}`);
      }

      const data = await response.json();
      res.status(200).json(data);

    } else if (method === 'POST') {
      // Crear cliente en BSale
      const clientData = req.body;

      const response = await fetch(`${bsaleUrl}/clients.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(clientData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`BSale API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      res.status(200).json(data);

    } else {
      res.status(405).json({ error: 'Método no permitido' });
    }

  } catch (error) {
    console.error('Error en proxy BSale clientes:', error);
    res.status(500).json({ 
      error: 'Error en servidor proxy', 
      details: error.message 
    });
  }
}
