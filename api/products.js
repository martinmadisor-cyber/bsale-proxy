export default async function handler(req, res) {
  // CORS headers completos
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, access_token');
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
    
    console.log('Llamando a BSale URL:', url);
    
    // Hacer request a BSale
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'access_token': token,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Error de BSale:', response.status, response.statusText);
      return res.status(response.status).json({ 
        error: `Error de BSale: ${response.status} ${response.statusText}` 
      });
    }

    const data = await response.json();
    console.log('Datos recibidos de BSale:', data.count || 'producto individual');

    // Si tenemos productos (lista), intentar enriquecer con variantes
    if (data.items && !id) {
      console.log(`Procesando ${data.items.length} productos...`);
      
      const enrichedProducts = [];
      
      // Procesar solo los primeros 10 productos para evitar timeout
      const productsToProcess = data.items.slice(0, 10);
      
      for (const product of productsToProcess) {
        try {
          const enrichedProduct = await enrichWithVariants(product, token);
          enrichedProducts.push(enrichedProduct);
        } catch (error) {
          console.error(`Error procesando producto ${product.id}:`, error.message);
          // Si falla, usar el producto original
          enrichedProducts.push({
            ...product,
            price: 0,
            totalStock: 0,
            variants: [],
            isAvailable: false,
            hasMultipleVariants: false
          });
        }
      }
      
      return res.status(200).json({
        ...data,
        items: enrichedProducts
      });
    }
    
    // Si es un producto individual, enriquecer con variantes
    if (id && data.id) {
      try {
        const enrichedProduct = await enrichWithVariants(data, token);
        return res.status(200).json(enrichedProduct);
      } catch (error) {
        console.error(`Error procesando producto individual ${id}:`, error.message);
        return res.status(200).json({
          ...data,
          price: 0,
          totalStock: 0,
          variants: [],
          isAvailable: false
        });
      }
    }

    // Devolver datos originales si no es producto
    return res.status(200).json(data);

  } catch (error) {
    console.error('Error general:', error);
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
}

async function enrichWithVariants(product, token) {
  try {
    console.log(`Obteniendo variantes para: ${product.name}`);
    
    const variantResponse = await fetch(
      `https://api.bsale.io/v1/products/${product.id}/variants.json`, 
      {
        headers: { 'access_token': token },
        timeout: 5000 // 5 segundos timeout
      }
    );
    
    if (!variantResponse.ok) {
      console.log(`No se pudieron obtener variantes para ${product.id}: ${variantResponse.status}`);
      return createBasicProduct(product);
    }

    const variants = await variantResponse.json();
    const variantItems = variants.items || [];

    if (variantItems.length === 0) {
      return createBasicProduct(product);
    }

    // Extraer precios de las variantes
    const prices = [];
    const stocks = [];
    
    variantItems.forEach(variant => {
      // Buscar precio en diferentes campos
      const price = variant.finalPrice || variant.price || variant.unitValue || 0;
      if (price > 0) {
        prices.push(price);
      }
      
      // Buscar stock en diferentes campos
      const stock = variant.quantityAvailable || variant.stock || variant.actualStock || 0;
      stocks.push(stock);
    });

    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    const totalStock = stocks.reduce((sum, stock) => sum + stock, 0);
    
    console.log(`${product.name}: Precio ${minPrice}-${maxPrice}, Stock ${totalStock}`);

    return {
      ...product,
      price: minPrice,
      minPrice: minPrice,
      maxPrice: maxPrice,
      priceRange: minPrice === maxPrice ? `$${minPrice.toLocaleString()}` : `$${minPrice.toLocaleString()} - $${maxPrice.toLocaleString()}`,
      hasPriceRange: minPrice !== maxPrice && maxPrice > 0,
      totalStock: totalStock,
      stockQuantity: totalStock,
      isAvailable: totalStock > 0,
      totalVariants: variantItems.length,
      hasMultipleVariants: variantItems.length > 1,
      availableVariants: variantItems.filter(v => (v.quantityAvailable || v.stock || 0) > 0).length,
      variants: variantItems.map(v => ({
        id: v.id,
        code: v.code,
        description: v.description,
        price: v.finalPrice || v.price || v.unitValue || 0,
        stock: v.quantityAvailable || v.stock || v.actualStock || 0,
        isAvailable: (v.quantityAvailable || v.stock || v.actualStock || 0) > 0,
        barCode: v.barCode,
        attribute1Value: v.attribute1Value,
        attribute2Value: v.attribute2Value
      })),
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    console.error(`Error enriqueciendo producto ${product.id}:`, error.message);
    return createBasicProduct(product);
  }
}

function createBasicProduct(product) {
  return {
    ...product,
    price: 0,
    minPrice: 0,
    maxPrice: 0,
    priceRange: "Sin precio",
    hasPriceRange: false,
    totalStock: 0,
    stockQuantity: 0,
    isAvailable: false,
    totalVariants: 0,
    hasMultipleVariants: false,
    availableVariants: 0,
    variants: [],
    lastUpdated: new Date().toISOString()
  };
}
