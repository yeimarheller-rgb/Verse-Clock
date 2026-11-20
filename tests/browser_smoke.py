# Arranca la web en Chromium (tamaño iPhone y escritorio) y falla si no inicia de verdad.
# Uso: python3 tests/browser_smoke.py http://localhost:8000/
import re, sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8000/'
fails = []
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, vp in (('iphone', {'width': 390, 'height': 844}), ('desktop', {'width': 1440, 'height': 900})):
        pg = b.new_page(viewport=vp); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.goto(BASE + '?t=2026-11-04T21:39:00Z#Lorville')
        try:
            pg.wait_for_function("/^\\d\\d:\\d\\d:\\d\\d$/.test(document.getElementById('clock').getAttribute('aria-label')||'')", timeout=8000)
        except Exception:
            fails.append(f'{name}: el reloj no arranca')
        if errs: fails.append(f'{name}: errores JS {errs}')
        if pg.inner_text('#place').strip().lower() != 'lorville': fails.append(f'{name}: no carga Lorville')
        if 'Cargando' in pg.inner_text('#where'): fails.append(f'{name}: catálogo sin cargar')
        if re.search(r'\\n', pg.inner_text('body')): fails.append(f'{name}: texto "\\\\n" visible en la página')
        # sin temblor: el ancho del reloj no cambia entre horas con cifras estrechas y anchas
        w = pg.evaluate("""() => { const c = document.getElementById('clock'); const box = () => c.getBoundingClientRect().width;
          const f = (t) => { c.dataset.v=''; c.innerHTML=[...t].map(ch=>/\\d/.test(ch)?`<span class="dg">${ch}</span>`:'<span class="cl">:</span>').join(''); return box(); };
          return [f('11:11:11'), f('00:00:00')]; }""")
        if abs(w[0] - w[1]) > 0.5: fails.append(f'{name}: el reloj cambia de ancho {w}')
        # reloj fluido: en Hurston 1 s real ≈ 9,7 s de juego; los segundos deben avanzar de 1 en 1, sin saltos
        steps = pg.evaluate("""() => new Promise(res => { const seen = []; const t0 = performance.now();
          const sec = v => { const [h, m, s] = v.split(':').map(Number); return h * 3600 + m * 60 + s; };
          (function f() { const v = document.getElementById('clock').getAttribute('aria-label'); if (seen.at(-1) !== v) seen.push(v);
            if (performance.now() - t0 < 1500) requestAnimationFrame(f); else res(seen.slice(1).map((v, i) => (sec(v) - sec(seen[i]) + 86400) % 86400)); })(); })""")
        if not steps or max(steps) > 2: fails.append(f'{name}: los segundos saltan {steps[:12]}')
        # buscador predictivo
        pg.fill('#q', 'jumpt'); pg.wait_for_timeout(200)
        if 'Jumptown' not in pg.inner_text('#suggestions'): fails.append(f'{name}: el buscador no sugiere')
        pg.fill('#q', 'hathor'); pg.wait_for_timeout(200)
        if pg.locator('#suggestions button').count() < 12: fails.append(f'{name}: «hathor» no muestra las instalaciones Hathor')
        if pg.evaluate('document.documentElement.scrollWidth') > vp['width'] + 1: fails.append(f'{name}: desborde horizontal')
        pg.close()
    # LAB: comprobar medidas reales y orden visual en Chromium, no solo CSS estático.
    for name, vp in (('iphone', {'width': 390, 'height': 844}), ('desktop', {'width': 1440, 'height': 900})):
        pg=b.new_page(viewport=vp);pg.goto(BASE+'lab-preview/?visual-test=1')
        pg.wait_for_selector('#atlasProgressBar')
        pg.wait_for_timeout(1200)
        box=pg.evaluate("""() => {const ids=['q','fav','atlasProgressBar'];const r=id=>{const x=document.getElementById(id).getBoundingClientRect();return {top:x.top,bottom:x.bottom,height:x.height,width:x.width}};const s=document.querySelector('.search').getBoundingClientRect(),p=document.querySelector('.atlas-progress').getBoundingClientRect();return {q:r('q'),fav:r('fav'),bar:r('atlasProgressBar'),search:{top:s.top,bottom:s.bottom,height:s.height},progress:{top:p.top,bottom:p.bottom,height:p.height},scrollWidth:document.documentElement.scrollWidth}}""")
        if not 44<=box['q']['height']<=60:fails.append(f"{name}: buscador alto {box['q']['height']}px")
        if not 44<=box['fav']['height']<=60:fails.append(f"{name}: favorito alto {box['fav']['height']}px")
        if not 44<=box['search']['height']<=65:fails.append(f"{name}: contenedor buscador alto {box['search']['height']}px")
        if box['progress']['top']<box['search']['bottom']+2:fails.append(f"{name}: progreso solapado con buscador {box}")
        if box['progress']['height']<75:fails.append(f"{name}: barra progreso colapsada {box}")
        if box['scrollWidth']>vp['width']+1:fails.append(f"{name}: overflow horizontal LAB")
        pg.screenshot(path=f'/tmp/verse-lab-{name}.png',full_page=True)
        print(f'LAB {name}: {box}')
        pg.close()
    b.close()
print('\n'.join(fails) or 'OK: la web arranca en iPhone y escritorio')
sys.exit(1 if fails else 0)
