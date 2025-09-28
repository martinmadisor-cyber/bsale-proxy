import { NextRequest, NextResponse } from 'next/server';

export async function GET(request) {
  try {
    // Obtener parámetros de la URL
    const { searchParams } = new URL(request.url);
    const shop = searchParams.get('shop');
    const accessToken = searchParams.get('access_token');

    // Validar parámetros requeridos
    if (!shop || !accessToken) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos: shop y access_token' },
        { status: 400 }
      );
    }

    console.log(`Obteniendo productos de la tienda: ${shop}`);

    // Hacer la llamada a la API de Shopify con campos específicos
    const response = await fetch(
      `https://${shop}.myshopify.com/admin/api/2023-01/products.json?fields=id,title,handle,images,variants,product_type,tags&limit=50`,
      {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      }
    );

    // Verificar si la respuesta es exitosa
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error de Shopify:', response.status, errorText);
      return NextResponse.json(
        { error: `Error de Shopify: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    // Parsear la respuesta JSON
    const data = await response.json();
    console.log(`Productos obtenidos: ${data.products?.length || 0}`);

    // Obtener información de inventario adicional si es necesario
    if (data.products && data.products.length > 0) {
      for (let product of data.products) {
        if (product.variants && product.variants.length > 0) {
          for (let variant of product.variants) {
            if (variant.inventory_item_id) {
              try {
                const inventoryResponse = await fetch(
                  `https://${shop}.myshopify.com/admin/api/2023-01/inventory_levels.json?inventory_item_ids=${variant.inventory_item_id}`,
                  {
                    headers: {
                      'X-Shopify-Access-Token': accessToken,
                      'Content-Type': 'application/json',
                    },
                  }
                );
                
                if (inventoryResponse.ok) {
                  const inventoryData = await inventoryResponse.json();
                  if (inventoryData.inventory_levels && inventoryData.inventory_levels.length > 0) {
                    variant.inventory_quantity = inventoryData.inventory_levels[0].available || 0;
                  }
                }
              } catch (error) {
                console.log('Error obteniendo inventario para variant:', variant.id, error);
                variant.inventory_quantity = 0;
              }
            }
          }
        }
      }
    }

    // Transformar los datos al formato deseado
    const transformedProducts = data.products.map(product => {
      // Obtener el precio del primer variant (o 0 si no hay variants)
      const mainPrice = product.variants && product.variants.length > 0 
        ? parseFloat(product.variants[0].price) 
        : 0;

      // Obtener el stock del primer variant (o 0 si no hay variants)
      const mainStock = product.variants && product.variants.length > 0 
        ? (product.variants[0].inventory_quantity || 0)
        : 0;

      // Obtener la imagen principal
      const mainImage = product.images && product.images.length > 0 
        ? product.images[0].src 
        : null;

      return {
        id: product.id,
        title: product.title,
        handle: product.handle,
        price: mainPrice,
        stock: mainStock,
        image: mainImage,
        product_type: product.product_type || '',
        tags: product.tags || '',
        variants: product.variants ? product.variants.map(variant => ({
          id: variant.id,
          title: variant.title,
          price: parseFloat(variant.price) || 0,
          inventory_quantity: variant.inventory_quantity || 0,
          sku: variant.sku || '',
          option1: variant.option1 || '',
          option2: variant.option2 || '',
          option3: variant.option3 || '',
          inventory_item_id: variant.inventory_item_id,
          weight: variant.weight || 0,
          weight_unit: variant.weight_unit || 'kg',
          available: variant.available !== undefined ? variant.available : true,
          inventory_management: variant.inventory_management || null,
          inventory_policy: variant.inventory_policy || 'deny'
        })) : []
      };
    });

    // Logs para debugging
    console.log('Productos transformados:', transformedProducts.length);
    if (transformedProducts.length > 0) {
      console.log('Primer producto:', {
        id: transformedProducts[0].id,
        title: transformedProducts[0].title,
        price: transformedProducts[0].price,
        stock: transformedProducts[0].stock,
        variants_count: transformedProducts[0].variants.length
      });
    }

    // Retornar la respuesta exitosa
    return NextResponse.json({
      success: true,
      products: transformedProducts,
      total: transformedProducts.length,
      shop: shop
    });

  } catch (error) {
    // Manejo de errores generales
    console.error('Error en el proxy de productos:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Método POST para crear/actualizar productos (opcional)
export async function POST(request) {
  try {
    const body = await request.json();
    const { shop, accessToken, productData } = body;

    if (!shop || !accessToken || !productData) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos' },
        { status: 400 }
      );
    }

    const response = await fetch(
      `https://${shop}.myshopify.com/admin/api/2023-01/products.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ product: productData }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Error de Shopify: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      product: data.product
    });

  } catch (error) {
    console.error('Error creando producto:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message },
      { status: 500 }
    );
  }
}
