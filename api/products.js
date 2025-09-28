export default async function handler(req, res) {
  // CORS headers completos
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { token, id } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Token requerido' });
  }

  try {
    // URL base para productos
    let url = id 
      ? `https://api.bsale.io/v1/products/${id}.json`
      : 'https://api.bsale.io/v1/products.json';
    
    let method = req.method;
    let body = null;

    if (method === 'POST' || method === 'PUT') {
      body = JSON.stringify(req.body);
    }

    // Hacer request a BSale
    const response = await fetch(url, {
      method: method,
      headers: {
        'access_token': token,
        'Content-Type': 'application/json'
      },
      body: body
    });

    const data = await response.json();

    // Si es GET y tenemos productos, obtener las variantes para cada uno
    if (method === 'GET' && data.items && !id) {
      const productsWithVariants = await Promise.all(
        data.items.map(async (product) => {
          try {
            // Obtener variantes del producto
            const variantResponse = await fetch(`https://api.bsale.io/v1/products/${product.id}/variants.json`, {
              headers: { 'access_token': token }
            });
            
            if (variantResponse.ok) {
              const variants = await variantResponse.json();
              
              // Obtener el primer precio y stock disponible
              let price = 0;
              let stock = 0;
              
              if (variants.items && variants.items.length > 0) {
                const firstVariant = variants.items[0];
                price = firstVariant.finalPrice || firstVariant.price || 0;
                stock = firstVariant.quantityAvailable || firstVariant.stock || 0;
              }
              
              return {
                ...product,
                price: price,
                stockQuantity: stock,
                variants: variants.items || []
              };
            }
            
            return {
              ...product,
              price: 0,
              stockQuantity: 0,
              variants: []
            };
          } catch (error) {
            return {
              ...product,
              price: 0,
              stockQuantity: 0,
              variants: []
            };
          }
        })
      );

      return res.status(response.status).json({
        ...data,
        items: productsWithVariants
      });
    }

    // Para requests individuales o POST/PUT, devolver respuesta normal
    res.status(response.status).json(data);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
