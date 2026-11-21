# Arranca la web en Chromium (tamaño iPhone y escritorio) y falla si no inicia de verdad.
# Uso: python3 tests/browser_smoke.py http://localhost:8000/
import re, sys
from playwright.sync_api import expect, sync_playwright

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
        try:
            pg.wait_for_function("document.getElementById('atlasQuality')?.dataset.loaded === 'true'", timeout=10000)
        except Exception:
            fails.append(f'{name}: el resumen compacto de cobertura no se ha cargado')
        pg.wait_for_timeout(300)
        box=pg.evaluate("""() => {const ids=['q','fav','atlasProgressBar'];const r=id=>{const x=document.getElementById(id).getBoundingClientRect();return {top:x.top,bottom:x.bottom,height:x.height,width:x.width}};const s=document.querySelector('.search').getBoundingClientRect(),p=document.querySelector('.atlas-progress').getBoundingClientRect();return {q:r('q'),fav:r('fav'),bar:r('atlasProgressBar'),search:{top:s.top,bottom:s.bottom,height:s.height},progress:{top:p.top,bottom:p.bottom,height:p.height},scrollWidth:document.documentElement.scrollWidth}}""")
        if not 44<=box['q']['height']<=60:fails.append(f"{name}: buscador alto {box['q']['height']}px")
        if not 44<=box['fav']['height']<=60:fails.append(f"{name}: favorito alto {box['fav']['height']}px")
        if not 44<=box['search']['height']<=65:fails.append(f"{name}: contenedor buscador alto {box['search']['height']}px")
        if box['progress']['top']<box['search']['bottom']+2:fails.append(f"{name}: progreso solapado con buscador {box}")
        if box['progress']['height']<75:fails.append(f"{name}: barra progreso colapsada {box}")
        if box['scrollWidth']>vp['width']+1:fails.append(f"{name}: overflow horizontal LAB")
        # Verificación funcional: las tarjetas tácticas deben responder a la selección.
        pg.fill('#q','Lamina PAF-I')
        pg.wait_for_timeout(350)
        options=pg.locator('#suggestions button')
        if options.count():
            options.first.click()
            pg.wait_for_timeout(250)
            cards=pg.locator('#intelTacticalCards .intel-tactical-card')
            if cards.count()!=6:fails.append(f'{name}: se esperaban 6 tarjetas tácticas, hay {cards.count()}')
            labels=pg.locator('#intelTacticalCards').inner_text()
            if 'BOTÍN' not in labels or 'PVE' not in labels or 'PVP' not in labels:fails.append(f'{name}: categorías tácticas ausentes')
            if 'Lamina' not in pg.locator('#mainIntelLocation').inner_text():fails.append(f'{name}: selección no actualiza inteligencia')
        else:fails.append(f'{name}: Lamina PAF-I no aparece en búsqueda')
        if pg.locator('#intelReadiness').count()!=1:fails.append(f'{name}: panel de cobertura documental ausente')
        if pg.locator('#intelReadiness .intel-readiness-meter span').count()!=1:fails.append(f'{name}: medidor de evidencia ausente')
        pg.fill('#q','Lazarus Complex')
        pg.wait_for_timeout(350)
        laz=pg.locator('#suggestions button')
        if not laz.count():fails.append(f'{name}: Lazarus no aparece en búsqueda')
        else:
            laz.first.click()
            pg.wait_for_timeout(200)
            dossier=pg.locator('#mainIntelApi').inner_text()
            if 'Valakkar' not in dossier or 'PASO 1' not in dossier:fails.append(f'{name}: dossier Lazarus incompleto')
        # El explorador inferior está oculto por diseño: probar el buscador principal.
        pg.fill('#q', 'Valakkar')
        pg.wait_for_timeout(350)
        if 'Lazarus' not in pg.locator('#suggestions').inner_text():
            fails.append(f'{name}: la búsqueda táctica Valakkar no encuentra los complejos Lazarus')
        else:
            pg.locator('#suggestions button').filter(has_text='Lazarus').first.click()
            if 'Valakkar' not in pg.locator('#mainIntelApi').inner_text():
                fails.append(f'{name}: la búsqueda Valakkar no abre su dossier táctico en el panel principal')
        # Validar recurso real de la API asociado por UUID, en el panel principal.
        pg.fill('#q', 'Jumptown')
        pg.wait_for_timeout(300)
        candidates=pg.locator('#suggestions button')
        if not candidates.count():
            fails.append(f'{name}: Jumptown no se puede seleccionar desde el buscador único')
        else:
            candidates.first.click()
            try:
                pg.wait_for_function("document.getElementById('mainIntelApi').textContent.includes('Amioshi Plague')", timeout=8000)
            except Exception:
                fails.append(f'{name}: no aparece Amioshi Plague, recurso API ligado a Jumptown por UUID')
        if pg.locator('#poiQuery').is_visible():
            fails.append(f'{name}: sigue visible el buscador inferior duplicado')
        def open_tactical(query, result):
            pg.locator('#q').fill(query)
            options = pg.locator('#suggestions button').filter(has_text=result)
            options.first.click(timeout=8000)
            expect(pg.locator('#mainIntelLocation')).to_contain_text(result)

        dossier = pg.locator('#locationDossier')
        open_tactical('hathor aberdeen', 'Ruptura PAF-I')
        expect(dossier).to_contain_text('S71 Justified')
        expect(dossier).to_contain_text('XL Purchase Order')
        assert int(pg.locator('#atlasProgressBar').get_attribute('aria-valuenow')) >= 100
        assert 'dest=stanton' in pg.url
        pg.reload()
        expect(dossier).to_contain_text('XL Purchase Order')
        expect(pg.locator('#mainIntelLocation')).to_contain_text('Ruptura PAF-I')
        expect(dossier).to_contain_text('HDMS-Anderson')
        expect(dossier).not_to_contain_text('Carinite')
        assert pg.locator('#tacticalPanel').bounding_box()['width'] > vp['width'] * 0.8
        pg.get_by_role('button', name='Buscar otra ubicación').click()
        expect(pg.locator('#q')).to_be_focused()
        pg.locator('#tacticalPanel').scroll_into_view_if_needed()
        pg.screenshot(path=f'/tmp/verse-lab-hathor-{name}.png')
        dossier.get_by_role('button', name='Ruptura OLP', exact=True).click()
        expect(dossier).to_contain_text('Carinite')
        expect(dossier.get_by_role('link', name='Citadel · minerales')).to_have_attribute('href', 'https://www.citadelsc.com/es/guides/hathor')
        dossier.get_by_role('button', name='HDMS-Anderson', exact=True).click()
        expect(dossier).to_contain_text('Reparación de nave')
        expect(dossier).not_to_contain_text('Valakkar')
        open_tactical('reparacion daymar', 'Shubin Mining Facility SCD-1')
        expect(dossier).to_contain_text('Reparación de nave')
        open_tactical('Seraphim', 'Seraphim Station')
        expect(dossier).to_contain_text('Admin - Seraphim')
        expect(dossier).to_contain_text('Reparación de nave')
        pg.screenshot(path=f'/tmp/verse-lab-seraphim-{name}.png')
        open_tactical('checkmate station', 'Checkmate')
        expect(dossier).to_contain_text('Placas 1, 2 y 3')
        expect(dossier).to_contain_text('Reparación de nave')
        pg.screenshot(path=f'/tmp/verse-lab-checkmate-{name}.png')
        open_tactical('Levski', 'Levski')
        expect(dossier).to_contain_text('Reparación de nave')
        open_tactical('Lazarus Complex', 'Lazarus Complex')
        expect(dossier).to_be_hidden()
        if pg.evaluate('document.documentElement.scrollWidth') > vp['width'] + 1:
            fails.append(f'{name}: desborde horizontal al navegar por las fichas')
        repair_filter = pg.locator('#tacticalFilters').get_by_role('button', name='Reparación')
        expect(repair_filter.locator('svg[data-icon=repair]')).to_be_visible()
        repair_filter.click()
        expect(repair_filter).to_have_attribute('aria-pressed','true')
        pg.locator('#q').fill('Seraphim')
        expect(pg.locator('#suggestions svg[data-icon=repair]').first).to_be_visible()
        pg.locator('#suggestions button').first.click()
        expect(dossier.locator('svg[data-icon=repair][data-state=possible]')).to_be_visible()
        pg.get_by_role('button',name='Modo Operaciones').click()
        operations = pg.locator('#operationsPanel')
        expect(operations).to_be_visible()
        expect(operations).to_contain_text('Rearme · Desconocido')
        expect(operations.locator('svg[data-icon=rearm][data-state=unknown]')).to_be_visible()
        expect(operations.locator('svg[data-icon=refuel][data-state=possible]')).to_be_visible()
        pg.locator('#tacticalPanel').scroll_into_view_if_needed()
        pg.screenshot(path=f'/tmp/verse-lab-operaciones-{name}.png')
        pg.get_by_role('button',name='Modo Operaciones').click()
        expect(operations).to_be_hidden()
        repair_filter.click()
        expect(repair_filter).to_have_attribute('aria-pressed','false')
        pg.screenshot(path=f'/tmp/verse-lab-{name}.png',full_page=True)
        print(f'LAB {name}: {box}')
        pg.close()
    for name, width, height in [('iphone',390,844),('desktop',1440,900)]:
        page = b.new_page(viewport={'width': width, 'height': height})
        page.goto(BASE + 'lab-preview/iconos.html')
        tiles = page.locator('.icon-tile')
        expect(tiles).to_have_count(29)
        assert page.locator('.icon-tile svg').count() == 87
        assert page.locator('.tactical-icon-state').count() == 4
        assert page.evaluate('document.documentElement.scrollWidth') <= width
        for tile in tiles.all():
            assert [svg.bounding_box()['width'] for svg in tile.locator('svg').all()] == [20,24,32]
        assert len(set(page.locator('.icon-tile svg[width="24"] path').evaluate_all('(paths) => paths.map(p => p.getAttribute("d"))'))) == 29
        page.screenshot(path=f'/tmp/verse-lab-iconografia-{name}.png',full_page=True)
        page.close()
    b.close()
print('\n'.join(fails) or 'OK: la web arranca en iPhone y escritorio')
sys.exit(1 if fails else 0)
