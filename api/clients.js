export default async function handler(req, res) {
  // CORS headers completos
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Manejar preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { token, id } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Token requerido' });
  }

  try {
    // Si hay ID, es una request específica, sino es general
    let url = id 
      ? `https://api.bsale.io/v1/clients/${id}.json`
      : 'https://api.bsale.io/v1/clients.json';
    
    let method = req.method;
    let body = null;

    // Para POST y PUT, incluir el body
    if (method === 'POST' || method === 'PUT') {
      body = JSON.stringify(req.body);
    }

    const response = await fetch(url, {
      method: method,
      headers: {
        'access_token': token,
        'Content-Type': 'application/json'
      },
      body: body
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
