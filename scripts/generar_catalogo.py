import pandas as pd, json, re
from pathlib import Path
from datetime import datetime

CATALOGO_XLSX = Path("datos/Catalogo_MG_Store_Maestro_Definitivo.xlsx")
PRECIOS_CSV   = Path("datos/precios.csv")
PRECIOS_XLSX  = Path("datos/precios.xlsx")
OUT           = Path("datos/catalogo.json")
OUT.parent.mkdir(parents=True, exist_ok=True)


# ---------- Utilidades ----------
def norm(s):
    s = "" if s is None else str(s).lower()
    return re.sub(r"[^a-z0-9 ]", "", s.translate(str.maketrans("áéíóúñ", "aeioun"))).strip()


def clean(v):
    if v is None: return ""
    try:
        if pd.isna(v): return ""
    except (TypeError, ValueError):
        pass
    return re.sub(r"\s+", " ", str(v)).strip()


def category(name):
    n = norm(name)
    rules = [
        ("Servicios técnicos",     ["reparacion", "reparaciones"]),
        ("Frenos",                 ["freno", "pastilla", "forro", "pinza", "bomba", "pulmon", "manguera", "manija"]),
        ("Iluminación",            ["faro", "farol", "intermitente", "neblinero", "led", "bombillo"]),
        ("Ruedas y llantas",       ["goma", "llanta", "rueda", "rin", "valvula"]),
        ("Químicos y sprays",      ["spray", "pintura", "limpiador", "abrillantador", "grasa", "barniz", "aflojalo"]),
        ("Sistema eléctrico",      ["alarma", "conmutador", "voltimetro", "pito", "musica", "twitter", "gps", "breker",
                                     "flasher", "regleta", "caja de luces", "toma de carga", "cargador"]),
        ("Motor y transmisión",    ["bujia", "chucho", "kit de junta", "kit de rodamiento", "reten", "filtro", "6301"]),
        ("Carrocería y controles", ["espejo", "manubrio", "puño", "puno", "slaider", "slider", "estribo", "letra", "capas"]),
        ("Accesorios y tornillería",["brida", "tornillo", "candado", "liga", "embellecedor", "quita ruido", "tapa de valvula", "paquete"]),
    ]
    for cat, keys in rules:
        if any(k in n for k in keys): return cat
    return "Accesorios y tornillería"


# ---------- 1) Cargar tabla de precios ----------
def cargar_precios():
    if PRECIOS_XLSX.exists():
        df = pd.read_excel(PRECIOS_XLSX)
        fuente = PRECIOS_XLSX
    elif PRECIOS_CSV.exists():
        df = pd.read_csv(PRECIOS_CSV, encoding="utf-8")
        fuente = PRECIOS_CSV
    else:
        print(f"⚠️  No encontré {PRECIOS_CSV} ni {PRECIOS_XLSX}. Los precios quedarán en null.")
        return {}, None

    df.columns = [str(c).strip().lower() for c in df.columns]
    mapa = {}
    for _, r in df.iterrows():
        code = clean(r.get("codigo"))
        if not code: continue
        minor = pd.to_numeric(r.get("precio_minorista_usd"), errors="coerce")
        mayor = pd.to_numeric(r.get("precio_mayorista_usd"), errors="coerce")
        mapa[code] = {import pandas as pd, json, re
from pathlib import Path
from datetime import datetime

CATALOGO_CSV = Path("datos/catalogo.csv")
CATALOGO_XLSX = Path("datos/catalogo.xlsx")
PRECIOS_CSV = Path("datos/precios.csv")
PRECIOS_XLSX = Path("datos/precios.xlsx")
OUT = Path("datos/catalogo.json")
OUT.parent.mkdir(parents=True, exist_ok=True)


def clean(v):
    if v is None: return ""
    try:
        if pd.isna(v): return ""
    except (TypeError, ValueError):
        pass
    return re.sub(r"\s+", " ", str(v)).strip()


def leer_tabla(csv_path, xlsx_path):
    """Lee CSV si existe, si no XLSX."""
    if csv_path.exists():
        df = pd.read_csv(csv_path, encoding="utf-8")
        fuente = csv_path.name
    elif xlsx_path.exists():
        df = pd.read_excel(xlsx_path)
        fuente = xlsx_path.name
    else:
        return None, None
    df.columns = [str(c).strip().lower() for c in df.columns]
    return df, fuente


# ---------- 1) Catálogo ----------
cat_df, cat_fuente = leer_tabla(CATALOGO_CSV, CATALOGO_XLSX)
if cat_df is None:
    raise SystemExit(f"❌ No encontré {CATALOGO_CSV} ni {CATALOGO_XLSX}")

# ---------- 2) Precios ----------
pre_df, pre_fuente = leer_tabla(PRECIOS_CSV, PRECIOS_XLSX)
if pre_df is None:
    print(f"⚠️  No encontré precios. Los precios quedarán en null.")
    precios = {}
else:
    precios = {}
    for _, r in pre_df.iterrows():
        code = clean(r.get("codigo"))
        if not code: continue
        minor = pd.to_numeric(r.get("precio_minorista_usd"), errors="coerce")
        mayor = pd.to_numeric(r.get("precio_mayorista_usd"), errors="coerce")
        precios[code] = {
            "retail": float(minor) if pd.notna(minor) else None,
            "wholesale": float(mayor) if pd.notna(mayor) else None,
        }
    print(f"✅ {len(precios)} precios cargados desde {pre_fuente}")

# ---------- 3) JOIN ----------
items, issues, seen = [], [], set()
for i, r in cat_df.iterrows():
    name = clean(r.get("producto"))
    if not name or name.lower() == "nan":
        continue
    code = clean(r.get("codigo"))
    if not code or code in seen:
        issues.append(f"Fila {i+2}: código vacío o duplicado ({code}). Se omite.")
        continue
    seen.add(code)

    unidades = pd.to_numeric(r.get("unidades"), errors="coerce")
    disp = clean(r.get("disponibilidad")).lower() == "disponible"
    p = precios.get(code, {"retail": None, "wholesale": None})

    items.append({
        "code": code,
        "name": name,
        "cat": clean(r.get("categoria")) or "Accesorios y tornillería",
        "seccion": clean(r.get("seccion")),
        "stock": int(unidades) if pd.notna(unidades) else 0,
        "disponible": disp,
        "retail": p["retail"],
        "wholesale": p["wholesale"],
        "photo": clean(r.get("foto")) or f"fotos/{code}.jpg",
    })

    if p["retail"] is None: issues.append(f"Sin precio minorista: {code}")
    if p["wholesale"] is None: issues.append(f"Sin precio mayorista: {code}")

# ---------- 4) Guardar JSON ----------
payload = {
    "version": datetime.now().strftime("%Y%m%d-%H%M"),
    "generated_at": datetime.now().isoformat(timespec="seconds"),
    "total": len(items),
    "items": items,
}
OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

# ---------- 5) QA ----------
print(f"\n✅ Catálogo generado: {len(items)} productos → {OUT}")
print(f"   Categorías: {sorted(set(i['cat'] for i in items))}")
print(f"   Sin precio minorista: {sum(1 for i in items if i['retail'] is None)}")
print(f"   Sin precio mayorista: {sum(1 for i in items if i['wholesale'] is None)}")
print(f"   Disponibles: {sum(1 for i in items if i['disponible'])}")
print(f"   Agotados: {sum(1 for i in items if not i['disponible'])}")
if issues:
    print(f"\n⚠️  {len(issues)} observaciones (primeras 15):")
    for x in issues[:15]:
        print(f"   - {x}")
