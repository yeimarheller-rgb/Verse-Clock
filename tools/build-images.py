# Convierte los fondos originales (img/src/*.png|jpg|jpeg|webp) a WebP optimizado en img/bg/.
# Nombres esperados: night|sunrise|day|sunset + -wide (horizontal) | -tall (vertical). Se ejecuta en CI.
# Si falta alguno, no se genera nada de esa fase y la web usa la escena procedural.
import pathlib, sys
from PIL import Image, ImageOps

SRC, OUT = pathlib.Path('img/src'), pathlib.Path('img/bg')
MAX = {'wide': (2560, 1440), 'tall': (1290, 2796)}
OUT.mkdir(parents=True, exist_ok=True)
found = {}
for f in sorted(SRC.glob('*')) if SRC.exists() else []:
    if f.suffix.lower() not in ('.png', '.jpg', '.jpeg', '.webp'): continue
    stem = f.stem.lower()
    if stem.count('-') != 1: continue
    phase, kind = stem.split('-')
    if phase not in ('night', 'sunrise', 'day', 'sunset') or kind not in MAX: continue
    im = ImageOps.exif_transpose(Image.open(f)).convert('RGB')
    im.thumbnail(MAX[kind], Image.LANCZOS)
    dst = OUT / f'{phase}-{kind}.webp'
    im.save(dst, 'WEBP', quality=82, method=6)
    found[stem] = (im.size, dst.stat().st_size // 1024)
for k, (size, kb) in found.items(): print(f'{k}: {size[0]}x{size[1]} {kb} KB')
missing = [f'{p}-{k}' for p in ('night', 'sunrise', 'day', 'sunset') for k in MAX if f'{p}-{k}' not in found]
if missing:
    print('Faltan:', ', '.join(missing), '→ la web usará la escena procedural.')
    for f in OUT.glob('*.webp'): f.unlink()  # sin juego completo, no se publica ninguna foto
sys.exit(0)
