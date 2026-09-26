"""
Genera datos/catalogo.json a partir de:
  - datos/catalogo.xlsx  (o .csv)
  - datos/precios.xlsx   (o .csv)
"""
import json
from datetime import datetime
from pathlib import Path
import pandas as pd

DATOS = Path("datos")
CATALOGO_XLSX = DATOS / "catalogo.xlsx"
CATALOGO_CSV = DATOS / "catalogo.csv"
PRECIOS_XLSX = DATOS / "precios.xlsx"
PRECIOS_CSV = DATOS / "precios.csv"
OUT = DATOS / "catalogo.json"


def limpiar(v):
    if v is None:
        return ""
    if isinstance(v, float) and pd.isna(v):
        return ""
    if pd.isna(v) if not isinstance(v, (list, dict)) else False:
        return ""
    return str(v).strip()


def leer_tabla(xlsx_path, csv_path):
    """Lee xlsx si existe, si no el csv."""
    if xlsx_path.exists():
        df = pd.read_excel(xlsx_path)
        fuente = xlsx_path.name
    elif csv_path.exists():
        df = pd.read_csv(csv_path, encoding="utf-8")
        fuente = csv_path.name
    else:
        return None, None
    df.columns = [str(c).strip().lower() for c in df.columns]
    return df, fuente


def main():
    cat, cat_fuente = leer_tabla(CATALOGO_XLSX, CATALOGO_CSV)
    if cat is None:
        raise SystemExit("No encontre datos/catalogo.xlsx ni datos/catalogo.csv")
    print("Catalogo leido desde:", cat_fuente)

    pre, pre_fuente = leer_tabla(PRECIOS_XLSX, PRECIOS_CSV)
    precios = {}
    if pre is None:
        print("Aviso: no hay archivo de precios, todos quedaran en null")
    else:
        for _, r in pre.iterrows():
            code = limpiar(r.get("codigo"))
            if not code:
                continue
            minor = pd.to_numeric(r.get("precio_minorista_usd"), errors="coerce")
            mayor = pd.to_numeric(r.get("precio_mayorista_usd"), errors="coerce")
            precios[code] = {
                "retail": float(minor) if pd.notna(minor) else None,
                "wholesale": float(mayor) if pd.notna(mayor) else None,
            }
        print("Precios leidos desde:", pre_fuente, "-", len(precios), "productos")

    items = []
    seen = set()
    for i, r in cat.iterrows():
        name = limpiar(r.get("producto"))
        if not name or name.lower() == "nan":
            continue
        code = limpiar(r.get("codigo"))
        if not code or code in seen:
            print("Fila", i + 2, "- codigo vacio o duplicado, se omite:", code)
            continue
        seen.add(code)

        unidades = pd.to_numeric(r.get("unidades"), errors="coerce")
        p = precios.get(code, {"retail": None, "wholesale": None})

        items.append({
            "code": code,
            "name": name,
            "cat": limpiar(r.get("categoria")) or "Sin categoria",
            "seccion": limpiar(r.get("seccion")),
            "stock": int(unidades) if pd.notna(unidades) else 0,
            "disponible": limpiar(r.get("disponibilidad")).lower() == "disponible",
            "retail": p["retail"],
            "wholesale": p["wholesale"],
            "photo": limpiar(r.get("foto")) or ("fotos/" + code + ".jpg"),
        })

    payload = {
        "version": datetime.now().strftime("%Y%m%d-%H%M"),
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "total": len(items),
        "items": items,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    sin_min = sum(1 for x in items if x["retail"] is None)
    sin_may = sum(1 for x in items if x["wholesale"] is None)
    disp = sum(1 for x in items if x["disponible"])
    print("")
    print("Generado:", OUT)
    print("Total:", len(items))
    print("Sin precio minorista:", sin_min)
    print("Sin precio mayorista:", sin_may)
    print("Disponibles:", disp)


if __name__ == "__main__":
    main()
