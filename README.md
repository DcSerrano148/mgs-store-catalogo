# MG's Store — Catálogo online

Catálogo mayorista y minorista de repuestos para motos eléctricas.

## Actualizar precios
1. Edita `datos/precios.csv`
2. Commit y push
3. GitHub Actions regenera `datos/catalogo.json` automáticamente
4. La web se actualiza en 1-2 minutos

## Actualizar stock
1. Edita `datos/catalogo.csv` (columna `unidades`)
2. Commit y push

## Estructura
- `index.html` — página principal
- `styles.css` — estilos
- `app.js` — carrito y WhatsApp
- `datos/catalogo.csv` — productos
- `datos/precios.csv` — precios
- `datos/catalogo.json` — generado automático (no editar)
- `scripts/generar_catalogo.py` — genera el JSON
- `fotos/` — imágenes de productos

## Correr local