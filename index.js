// Limpiar la URL
let path = url.replace('/api/bsale', '');
if (!path.startsWith('/')) path = '/' + path;

// No agregar .json si la ruta ya tiene extensión o parámetros
if (!path.includes('.json') && !path.includes('?') && !path.includes('=')) {
  // Solo agregar .json si no es una ruta anidada (como /products/123/variants)
  const pathParts = path.split('/').filter(p => p);
  if (pathParts.length <= 2 || !path.includes('/variants')) {
    path += '.json';
  } else if (path.includes('/variants')) {
    path += '.json';
  }
}
