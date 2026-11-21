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
    for device, width, height in [('iphone',390,844),('desktop',1440,900)]:
        page = b.new_page(viewport={'width':width,'height':height})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(BASE + 'lab-preview/')
        page.wait_for_function("document.getElementById('atlasProgressBar').getAttribute('aria-valuenow') > 0")
        expect(page.locator('#mainIntelLocation')).to_contain_text('Lorville')
        dossier = page.locator('#locationDossier')
        def verify_layout():
            search, clock, location = [page.locator(selector).bounding_box() for selector in ['.search','#solar','#tacticalPanel']]
            assert search['y'] + search['height'] <= clock['y'] <= search['y'] + search['height'] + 14
            assert clock['y'] + clock['height'] <= location['y']
            assert clock['height'] <= 105
            assert page.evaluate('document.documentElement.scrollWidth') <= width
            assert page.locator('#destinationIntel,#mainIntelApi,#intelTacticalCards').count() == 0
            domains = dossier.locator('[data-domain]').evaluate_all('(els) => els.map(el=>el.dataset.domain)')
            assert len(domains) == len(set(domains))
            facts = dossier.locator('.dossier-fact').all_text_contents()
            assert len(facts) == len(set(facts))
            sources = dossier.locator('ol a').evaluate_all('(els) => els.map(el=>el.href)')
            assert len(sources) == len(set(sources))
        def query(q, target=None):
            page.locator('#q').fill(q)
            result = page.locator('#suggestions button')
            if target:
                result = result.filter(has_text=target)
            result.first.click()
            expect(page.locator('#mainIntelLocation')).to_contain_text(target or q)
        def show_filters():
            if not page.locator('#searchFilters').is_visible():
                page.get_by_role('button', name='Filtros', exact=True).click()
        verify_layout()
        expect(page.locator('#clock')).to_have_attribute('aria-label', re.compile(r'\d\d:\d\d:\d\d'))
        page.screenshot(path=f'/tmp/verse-lab-despues-inicio-{device}.png',full_page=True)
        for q, label, needle in [
            ('Ruptura PAF-I','ruptura','XL Purchase Order'),
            ('Seraphim','seraphim','Admin - Seraphim'),('Lorville','lorville','Gravedad regional'),
            ('Everus','everus','Rearme · Documentado'),('Ghost Hollow','ghost-hollow','Nine Tails'),
            ('Checkmate','checkmate','Placas 1, 2 y 3'),
        ]:
            query(q)
            verify_layout()
            expect(dossier).to_contain_text(needle)
            assert dossier.inner_text().count(needle) <= 1
            if label in ['seraphim','everus','checkmate']:
                expect(page.locator('#where')).to_have_text('Hora local sin cálculo')
                expect(page.locator('#solarEvents')).to_be_hidden()
                expect(page.locator('#solarProgress')).to_be_hidden()
            if label=='ruptura':
                expect(dossier).to_contain_text('S71 Justified')
                expect(dossier).to_contain_text('HDMS-Anderson')
                expect(dossier).not_to_contain_text('Carinite')
                assert dossier.inner_text().count('Valakkar juveniles')==1
            page.evaluate('window.scrollTo(0,0)')
            page.screenshot(path=f'/tmp/verse-lab-despues-{label}-{device}.png',full_page=True)
        query('Ruptura PAF-I')
        page.reload()
        expect(page.locator('#mainIntelLocation')).to_have_text('Ruptura PAF-I')
        dossier.locator('details[data-domain=navigation] summary').click()
        dossier.get_by_role('button', name='Ruptura OLP', exact=True).click()
        expect(dossier).to_contain_text('Carinite')
        query('Lazarus Complex')
        expect(dossier).to_contain_text('Valakkar')
        expect(dossier).to_contain_text('1.')
        query('Jumptown')
        expect(dossier).to_contain_text('Amioshi Plague')
        query('Seraphim')
        show_filters()
        page.get_by_role('button',name='Modo Operaciones').click()
        expect(dossier.locator('section').first).to_have_attribute('data-domain','services')
        expect(dossier).to_contain_text('Rearme · Desconocido')
        assert dossier.locator('.service-icons').count() == 1
        assert dossier.inner_text().count('Reparación de nave') == 1
        page.get_by_role('button',name='Modo Operaciones').click()
        zone=page.get_by_role('combobox',name='Zona logística')
        zone.select_option('Daymar')
        rearm=page.locator('#tacticalFilters').get_by_role('button', name='Rearme')
        rearm.click()
        page.locator('#q').fill('Shubin')
        result=page.locator('#suggestions button').first
        expect(result.locator('svg[data-icon=rearm][data-state=confirmed]')).to_be_visible()
        result.click()
        expect(dossier).to_contain_text('Rearme · Documentado')
        verify_layout()
        show_filters()
        zone.select_option('')
        rearm.click()
        page.locator('#q').fill('MT OpCenter TLI-4')
        variants=page.locator('#suggestions button').filter(has_text='MT OpCenter TLI-4')
        expect(variants.nth(1)).to_be_visible()
        variants.nth(1).click()
        assert page.url.count('%7C') == 2
        page.reload()
        expect(page.locator('#mainIntelLocation')).to_contain_text('MT OpCenter TLI-4')
        page.get_by_text('Estado del atlas',exact=True).click()
        page.get_by_text('Cobertura de Stanton',exact=True).click()
        expect(page.locator('#stantonCoverage')).to_contain_text(re.compile(r'\d+ / 949 operativas'))
        query('Rappel')
        expect(dossier).to_contain_text('RAPPE, ID 274')
        expect(dossier).not_to_contain_text('UEX #274')
        expect(dossier).to_contain_text('Otra versión')
        query('Weeping Cove')
        dossier.locator('details[data-domain=navigation] summary').click()
        dossier.get_by_role('button',name="Cutter's Rig", exact=True).click()
        expect(page.locator('#mainIntelLocation')).to_have_text("Cutter's Rig")
        assert not errors, errors
        for hour, direction in [('13', 'atardecer'), ('14', 'amanecer')]:
            page.goto(BASE + f'lab-preview/?t=2026-11-21T{hour}:00:00Z#Lorville')
            expect(page.locator('#mainIntelLocation')).to_have_text('Lorville')
            expect(page.locator('#riseEvent')).to_be_visible()
            expect(page.locator('#setEvent')).to_be_visible()
            progress = page.locator('#solarProgress')
            expect(progress).to_be_visible()
            expect(progress).to_have_attribute('aria-label', f'Avance hasta el {direction}')
            before = float(progress.get_attribute('value'))
            assert 0 < before < 100
            page.wait_for_function('(value) => document.getElementById("solarProgress").value > value', arg=before)
            verify_layout()
            expect(dossier.locator('.environment-temperature')).to_have_text('Máxima de referencia 34 °C.')
            assert dossier.inner_text().count('34 °C') == 1
            page.screenshot(path=f'/tmp/verse-lab-solar-{direction}-{device}.png')
        query('Calliope', 'Calliope')
        expect(dossier.locator('.environment-temperature')).to_have_text('Máxima de referencia −72 °C.')
        page.close()
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
