export default async function handler(req, res) {
  // CORS headers
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

    // NUEVA LÓGICA: Procesar variantes para GET requests
    if (method === 'GET') {
      
      // Caso 1: Lista de productos (sin ID)
      if (data.items && !id) {
        console.log(`Procesando ${data.items.length} productos...`);
        
        const productsWithVariants = await Promise.all(
          data.items.map(async (product) => {
            return await enrichProductWithVariants(product, token);
          })
        );
        
        return res.status(response.status).json({
          ...data,
          items: productsWithVariants
        });
      }
      
      // Caso 2: Producto individual (con ID)
      if (id && data.id) {
        const enrichedProduct = await enrichProductWithVariants(data, token);
        return res.status(response.status).json(enrichedProduct);
      }
    }

    // Para requests que no son GET, devolver respuesta normal
    res.status(response.status).json(data);

  } catch (error) {
    console.error('Error en BSale proxy:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
}

// FUNCIÓN PRINCIPAL: Enriquecer producto con datos de variantes
async function enrichProductWithVariants(product, token) {
  try {
    console.log(`Procesando producto: ${product.name} (ID: ${product.id})`);
    
    // Obtener variantes del producto
    const variantResponse = await fetch(
      `https://api.bsale.io/v1/products/${product.id}/variants.json`, 
      {
        headers: { 'access_token': token }
      }
    );
    
    if (!variantResponse.ok) {
      console.log(`Error obteniendo variantes para producto ${product.id}: ${variantResponse.status}`);
      return createEmptyProductData(product);
    }

    const variants = await variantResponse.json();
    const variantItems = variants.items || [];

    console.log(`Producto ${product.id} tiene ${variantItems.length} variantes`);

    if (variantItems.length === 0) {
      return createEmptyProductData(product);
    }

    // PROCESAR PRECIOS Y STOCK
    const priceData = calculatePriceData(variantItems);
    const stockData = calculateStockData(variantItems);
    const variantsData = processVariants(variantItems);

    console.log(`Producto ${product.id} - Precio range: $${priceData.minPrice} - $${priceData.maxPrice}, Stock: ${stockData.totalStock}`);

    return {
      ...product,
      // Información de precios
      ...priceData,
      // Información de stock
      ...stockData,
      // Variantes procesadas
      variants: variantsData,
      // Metadata útil
      totalVariants: variantItems.length,
      hasMultipleVariants: variantItems.length > 1,
      isAvailable: stockData.totalStock > 0,
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    console.error(`Error obteniendo variantes para producto ${product.id}:`, error);
    return createEmptyProductData(product);
  }
}

// Calcular información de precios
function calculatePriceData(variants) {
  // Buscar precios en diferentes campos que BSale puede usar
  const prices = variants
    .map(v => {
      // Probar diferentes campos de precio que BSale usa
      return v.finalPrice || v.price || v.unitValue || v.netUnitValue || 0;
    })
    .filter(price => price > 0);

  console.log(`Precios encontrados: [${prices.join(', ')}]`);

  if (prices.length === 0) {
    return {
      price: 0,
      minPrice: 0,
      maxPrice: 0,
      priceRange: "Sin precio",
      hasPriceRange: false
    };
  }

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;

  return {
    price: minPrice, // Precio principal (el menor)
    minPrice: minPrice,
    maxPrice: maxPrice,
    averagePrice: Math.round(avgPrice),
    priceRange: minPrice === maxPrice ? `$${minPrice.toLocaleString()}` : `$${minPrice.toLocaleString()} - $${maxPrice.toLocaleString()}`,
    hasPriceRange: minPrice !== maxPrice
  };
}

// Calcular información de stock
function calculateStockData(variants) {
  const stocks = variants.map(v => {
    // Probar diferentes campos de stock que BSale usa
    return v.quantityAvailable || v.stock || v.actualStock || 0;
  });
  
  const totalStock = stocks.reduce((sum, stock) => sum + stock, 0);
  const availableVariants = stocks.filter(stock => stock > 0).length;

  return {
    stockQuantity: totalStock,
    totalStock: totalStock,
    maxVariantStock: Math.max(...stocks),
    minVariantStock: Math.min(...stocks),
    availableVariants: availableVariants,
    outOfStockVariants: variants.length - availableVariants
  };
}

// Procesar y limpiar variantes
function processVariants(variants) {
  return variants.map(variant => {
    const price = variant.finalPrice || variant.price || variant.unitValue || variant.netUnitValue || 0;
    const stock = variant.quantityAvailable || variant.stock || variant.actualStock || 0;
    
    return {
      id: variant.id,
      code: variant.code,
      description: variant.description,
      price: price,
      originalPrice: variant.price || 0,
      finalPrice: variant.finalPrice || price,
      stock: stock,
      isAvailable: stock > 0,
      // Mantener campos originales importantes
      barCode: variant.barCode,
      attribute1Value: variant.attribute1Value,
      attribute2Value: variant.attribute2Value,
      attribute3Value: variant.attribute3Value,
      unlimitedStock: variant.unlimitedStock,
      state: variant.state
    };
  });
}

// Crear estructura de producto vacío (fallback)
function createEmptyProductData(product) {
  return {
    ...product,
    price: 0,
    minPrice: 0,
    maxPrice: 0,
    priceRange: "Sin precio",
    hasPriceRange: false,
    stockQuantity: 0,
    totalStock: 0,
    variants: [],
    totalVariants: 0,
    hasMultipleVariants: false,
    isAvailable: false,
    availableVariants: 0,
    outOfStockVariants: 0,
    lastUpdated: new Date().toISOString()
  };
}

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
