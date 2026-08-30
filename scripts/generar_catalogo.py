import pandas as pd, json, re, numpy as np
from pathlib import Path

XLSX = Path("datos/Catalogo_MG_Store_Maestro_Definitivo.xlsx")
OUT = Path("datos/catalogo.json")

WHOLESALE = {
"Forros":4,"Manillas robóticas bomba cable":8,"Chuchos de único":9,
"Voltímetro configurables verdes":5,"Reparaciones de pinza":2.5,
"Reparaciones de bomba delantera":2,"Tapas de válvula Cohete paquete de 4":3,
"Pito 12v":3,"Alarmas":7.5,"Puños de 3V con Retroceso":10,
"Músicas de dos bocinas":20,"Bombas de freno con manillas y pulmón corto":23,
"Cajas de luces de 10 amp":5,"Espejos GN 125":6.5,
"Espejos mishusuky Negros":8.5,"Pastillas de freno":2.2}

def norm(s):
    return re.sub(r"\s+"," ",re.sub(r"[^a-z0-9 ]","",str(s).lower().translate(str.maketrans("áéíóúñ","aeioun")))).strip()
W={norm(k):v for k,v in WHOLESALE.items()}

def wp(name):
    n=norm(name)
    if n in W: return W[n]
    for k,v in W.items():
        if k in n or n in k: return v
    return None

def category(name):
    n=norm(name)
    if any(x in n for x in ["freno","pastilla","forro","pinza","bomba"]): return "Frenos"
    if any(x in n for x in ["voltimetro","alarma","pito","musica","caja de luces"]): return "Eléctrico"
    if any(x in n for x in ["luz","faro","bombillo","led"]): return "Iluminación"
    if any(x in n for x in ["espejo","manilla","puño","chucho"]): return "Controles y carrocería"
    if any(x in n for x in ["valvula","tapa"]): return "Accesorios"
    return "Otros"

df=pd.read_excel(XLSX,sheet_name="Catálogo")
df.columns=[str(c).strip() for c in df.columns]
items=[]
for _,r in df.iterrows():
    name=str(r.get("Producto","")).strip()
    if not name or name=="nan": continue
    stock=pd.to_numeric(r.get("Existencia"),errors="coerce")
    retail=pd.to_numeric(r.get("Precio_Minorista_USD"),errors="coerce")
    w=wp(name)
    items.append({
      "code":str(r.get("Código") or "").strip(),
      "name":name,
      "stock":int(stock) if pd.notna(stock) else 0,
      "retail":float(retail) if pd.notna(retail) else None,
      "wholesale":float(w) if w is not None else None,
      "cat":str(r.get("Categoría") or category(name)),
      "photo":f"fotos/{str(r.get('Código') or '').strip()}.jpg"
    })
OUT.write_text(json.dumps(items,ensure_ascii=False,indent=2),encoding="utf-8")
print(f"Generados {len(items)} productos en {OUT}")
