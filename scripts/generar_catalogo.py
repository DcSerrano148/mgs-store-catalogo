import pandas as pd
import json
from pathlib import Path

cat = pd.read_csv("datos/catalogo.csv")
pre = pd.read_csv("datos/precios.csv")

precios = {}
for _, r in pre.iterrows():
    precios[str(r["codigo"])] = r

items = []
for _, r in cat.iterrows():
    codigo = str(r["codigo"])
    p = precios.get(codigo, {})
    stock = r["unidades"]
    items.append({
        "code": codigo,
        "name": str(r["producto"]),
        "cat": str(r["categoria"]),
        "seccion": str(r["seccion"]),
        "stock": int(stock) if pd.notna(stock) else 0,
        "disponible": str(r["disponibilidad"]).lower() == "disponible",
        "retail": float(p.get("precio_minorista_usd", 0)) if p.get("precio_minorista_usd") else None,
        "wholesale": float(p.get("precio_mayorista_usd", 0)) if p.get("precio_mayorista_usd") else None,
        "photo": str(r["foto"]),
    })

Path("datos/catalogo.json").write_text(
    json.dumps({"total": len(items), "items": items}, ensure_ascii=False, indent=2),
    encoding="utf-8"
)
print("OK:", len(items), "productos")
