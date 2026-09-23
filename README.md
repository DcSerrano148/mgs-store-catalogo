# MG's Store — Catálogo Online

Catálogo mayorista y minorista de repuestos para motos eléctricas.

## Actualizar productos
1. Edita `datos/Catalogo_MG_Store_Maestro_Definitivo.xlsx`
2. Ejecuta: `python scripts/generar_catalogo.py`
3. Sube cambios: `git add . && git commit -m "Actualizar catálogo" && git push`

## Estructura
- `index.html` — página principal
- `styles.css` — estilos
- `app.js` — lógica del carrito y WhatsApp
- `datos/catalogo.json` — datos generados
- `scripts/generar_catalogo.py` — genera el JSON desde el Excel
- `fotos/` — imágenes de productos
