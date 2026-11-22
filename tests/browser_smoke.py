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
            assert clock['height'] <= 255, (device, clock, page.locator('#solar > :visible').evaluate_all('(els) => els.map(el => [el.className,el.offsetHeight])'))
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
        expect(page.locator('#clock')).to_have_attribute('aria-label', re.compile(r'\d\d:\d\d:\d\d'))
        page.screenshot(path=f'/tmp/verse-lab-despues-inicio-{device}.png',full_page=True)
        verify_layout()
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
                expect(page.locator('#solarTimeline')).to_be_hidden()
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
        expect(page.locator('#stantonCoverage')).to_contain_text('808 / 886 operativas · 91,2 %')
        expect(page.locator('#stantonCoverage')).to_contain_text('63 plataformas temporales de RSI Discovery Month fuera de cobertura')
        page.screenshot(path=f'/tmp/verse-lab-stanton-scope-{device}.png',full_page=True)
        page.locator('#q').fill('RSI Event Platform')
        expect(page.locator('#suggestions button').filter(has_text='RSI Event Platform')).to_have_count(0)
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
            expect(page.locator('#solarTimeline')).to_be_visible()
            expect(page.locator('.tll span')).to_have_text(['00:00','06:00','12:00','18:00','24:00'])
            track = page.locator('#tl')
            assert track.evaluate("el => getComputedStyle(el).backgroundImage").count('rgb(27, 42, 74)') == 2
            markers = page.locator('#tlRise,#tlSet').evaluate_all('els => els.map(el => parseFloat(el.style.left))')
            assert 0 < markers[0] < 50 < markers[1] < 100
            now = page.locator('#tlNow')
            before = now.evaluate('el => parseFloat(el.style.left)')
            h,m,s = map(int,page.locator('#clock').get_attribute('aria-label').split(':'))
            assert abs(before - (h*3600+m*60+s)/864) < 0.15
            page.wait_for_function('(value) => parseFloat(document.getElementById("tlNow").style.left) > value', arg=before)
            assert now.bounding_box()['width'] > 0
            reading = page.locator('#clock')
            assert reading.evaluate('el => parseFloat(getComputedStyle(el).fontSize)') >= (44 if device == 'iphone' else 75)
            hero = page.locator('#solar .hero').bounding_box()
            events = page.locator('#solarEvents').bounding_box()
            timeline = page.locator('#solarTimeline').bounding_box()
            assert timeline['y'] >= max(hero['y'] + hero['height'], events['y'] + events['height']) - 1
            assert timeline['width'] >= hero['width']
            if device == 'iphone':
                assert events['y'] >= hero['y'] + hero['height'] - 1
            else:
                assert abs(events['y'] - hero['y']) <= 1
                assert events['x'] >= hero['x'] + hero['width']
            verify_layout()
            expect(dossier.locator('.environment-temperature')).to_have_text('Máxima de referencia 34 °C.')
            assert dossier.inner_text().count('34 °C') == 1
            page.screenshot(path=f'/tmp/verse-lab-reloj-original-{direction}-{device}.png')
        for search_name, claim, patch in [
            ('HDSF-Elbridge', 'Evict Illegal Occupants', '4.10.3'),
            ('Klescher Rehabilitation Facility', 'Inmate Maintenance Opportunity', '4.10.3'),
            ('Everus Harbor Clinic', 'ParaMed Medical Device', '4.10.3'),
            ('HUR-L4 Melodic Fields Clinic', 'MedPen (Hemozal)', '4.10.3'),
        ]:
            query(search_name, search_name)
            expect(dossier).to_contain_text(claim)
            expect(dossier).to_contain_text(patch)
            assert dossier.inner_text().count(claim) == 1
            if search_name.endswith(' Clinic'):
                expect(page.locator('#where')).to_have_text('Hora local sin cálculo')
                expect(page.locator('#solarTimeline')).to_be_hidden()
                expect(dossier).not_to_contain_text('Entorno regional')
            verify_layout()
        page.screenshot(path=f'/tmp/verse-lab-clinica-hur-l4-{device}.png', full_page=True)
        for place, access_rule in [
            ('Covalex Distribution Centre S1DC06','Acceso público indicado'),
            ('HDPC-Cassillo','Permisos del interior'),
        ]:
            query(place, place)
            access = dossier.locator('details[data-domain=navigation]')
            access.locator('summary').click()
            expect(access).to_contain_text(access_rule)
            expect(access).to_contain_text('4.10.3-LIVE.13165946')
            assert access.inner_text().count(access_rule) == 1
        page.evaluate('window.scrollTo(0,0)')
        page.screenshot(path=f'/tmp/verse-lab-cassillo-{device}.png', full_page=True)
        for place, group, caption in [
            ("Brio's Breaker Yard", 'services', 'No Questions Asked'),
            ('Everus Harbor', 'services', 'Suministros y componentes'),
            ('Baijini Point', 'services', 'punto de reaparición hospitalaria'),
            ('Grim HEX', 'services', 'Recuperación médica'),
            ('Port Tressler', 'services', 'Clínica Kel-To'),
            ('Ghost Hollow', 'missions', 'Evento de créditos CCB'),
            ('HUR-L2 Faithful Dream Station', 'services', 'Clínica y escala de apoyo'),
        ]:
            query(place, place)
            expect(dossier.locator(f'[data-domain="{group}"]')).to_contain_text(caption)
            assert all(caption not in text for text in dossier.locator('[data-domain="navigation"]').all_text_contents())
        expect(dossier.locator('[data-domain="services"]')).not_to_contain_text('No se confirma clínica')
        verify_layout()
        page.evaluate('window.scrollTo(0,0)')
        page.screenshot(path=f'/tmp/verse-lab-faithful-dream-{device}.png', full_page=True)
        for place, group, caption in [
            ('Reclamation & Disposal Orinth', 'services', 'Venta al terminal'),
            ('Sakura Sun Magnolia Workcenter', 'services', 'Ascensor de carga y hangar sin corroborar'),
            ('Barton Flats Aid Shelter', 'navigation', 'Refugio para emergencias'),
        ]:
            query(place, place)
            section = dossier.locator(f'[data-domain="{group}"]')
            if group == 'navigation':
                section.locator('summary').click()
            expect(section).to_contain_text(caption)
            assert dossier.inner_text().count(caption) == 1
            if place == 'Barton Flats Aid Shelter':
                expect(dossier).not_to_contain_text('Nine Tails')
            verify_layout()
            page.evaluate('window.scrollTo(0,0)')
            page.screenshot(path=f'/tmp/verse-lab-hurston-{place.split()[0].lower()}-{device}.png', full_page=True)
        for place in ['Gonzo', 'Ludlow', 'HDMS-Lathan', "Adair's Retreat", 'Dunboro', 'Paradise Cove']:
            query(place, place)
            resources = dossier.locator('[data-domain="loot"]')
            expect(resources).to_contain_text('Minería a pie')
            expect(resources).to_contain_text('OreBit')
            assert resources.inner_text().count('Hadanite') == 1
            assert resources.inner_text().count('Janalite') == 1
            expect(resources).to_contain_text('Recursos catalogados por UUID')
            assert 'no garantiza aparición ni cantidad' not in resources.inner_text()
            verify_layout()
            if place in ['Gonzo','Ludlow']:
                page.evaluate('window.scrollTo(0,0)')
                page.screenshot(path=f'/tmp/verse-lab-mineria-{place.lower()}-{device}.png', full_page=True)
        for place, suffix in [('Mining Base #Q9Q-090', None), ('Mining Base #XJZ-JR2', '076add9c')]:
            if suffix:
                page.locator('#q').fill(place)
                page.locator('#suggestions button').filter(has_text=suffix).first.click()
                expect(page.locator('#mainIntelLocation')).to_have_text(place)
            else:
                query(place, place)
            resources = dossier.locator('[data-domain="loot"]')
            expect(resources).to_contain_text('Prospección con nave minera')
            expect(resources).to_contain_text('Recursos catalogados por UUID')
            nav = dossier.locator('[data-domain="navigation"]')
            nav.locator('summary').click()
            expect(nav).to_contain_text('Marcador visible sin salto directo')
            expect(dossier.locator('[data-domain="security"]')).to_have_count(0)
            verify_layout()
            page.evaluate('window.scrollTo(0,0)')
            page.screenshot(path=f'/tmp/verse-lab-base-minera-{place.split("#")[-1]}-{device}.png', full_page=True)
        for name, ore in [('HUR L1', 'Laranite'), ('CRU L2', 'Bexalite'), ('MIC L3', 'Aslarite')]:
            query(name, name)
            field = dossier.locator('[data-domain="loot"]')
            expect(field).to_contain_text('Campo minero regional')
            expect(field).to_contain_text(ore)
            expect(dossier).not_to_contain_text('Marcador visible sin salto directo')
            if name == 'HUR L1':
                expect(field).to_contain_text('HUR-L1 Green Glade Station')
            verify_layout()
            page.evaluate('window.scrollTo(0,0)')
            page.screenshot(path=f'/tmp/verse-lab-lagrange-{name.replace(" ","-")}-{device}.png', full_page=True)
        for name, section_name, caption in [
            ('ARC-L1 Wide Forest Clinic','services','Hospital y regeneración'),
            ('Devlin Scrap & Salvage','services','WiDoW'),
            ('Cry-Astro Processing Plant 19-02','navigation','Acceso público restringido'),
        ]:
            query(name, name)
            section = dossier.locator(f'[data-domain="{section_name}"]')
            if section_name == 'navigation':
                section.locator('summary').click()
            expect(section).to_contain_text(caption)
            if name.startswith('ARC-L1'):
                expect(dossier).not_to_contain_text('Entorno regional')
            verify_layout()
            page.evaluate('window.scrollTo(0,0)')
            page.screenshot(path=f'/tmp/verse-lab-stanton-facilities-{name.split()[0]}-{device}.png', full_page=True)
        for name, terminal in [
            ('ARC-L5 Yellow Core Clinic', 'Pharmacy - ARC-L5'),
            ('MIC-L3 Endless Odyssey Clinic', 'Pharmacy - MIC-L3'),
            ('Orison General', 'Pharmacy - Orison General Hospital'),
        ]:
            query(name, name)
            pharmacy = dossier.locator('[data-domain="services"]')
            expect(pharmacy).to_contain_text(terminal)
            expect(pharmacy).to_contain_text('Pancea MedGel Canister')
            expect(pharmacy.get_by_text('Farmacia y MedGel para naves', exact=True)).to_have_count(1)
            expect(pharmacy).not_to_contain_text('Hospital y regeneración')
            verify_layout()
            page.evaluate('window.scrollTo(0,0)')
            page.screenshot(path=f'/tmp/verse-lab-stanton-pharmacy-{name.split()[0]}-{device}.png', full_page=True)
        for name, detail in [
            ('Shubin Processing Facility SPAL-12', '13 puntos de botín'),
            ('Shubin Processing Facility SPMC-14', 'P8-SC SMG'),
            ('Onyx Facility S3A1', 'Corbel Smolder'),
        ]:
            query(name, name)
            loot = dossier.locator('[data-domain="loot"]')
            expect(loot).to_contain_text(detail)
            expect(loot.locator('.dossier-fact').filter(has_text=detail)).to_have_count(1)
            if name.endswith('SPMC-14'):
                expect(dossier).to_contain_text('Remove Illegal Occupants')
            verify_layout()
            page.evaluate('window.scrollTo(0,0)')
            page.screenshot(path=f'/tmp/verse-lab-stanton-bunker-{name.split()[-1]}-{device}.png', full_page=True)
        for search, name, item, container in [
            ('Paladin', 'Zephyr', 'Casco Paladin', 'Metal loot crate'),
            ("Picker's Field", "Picker's Field", 'Casco Paladin', 'Weapon case'),
            ('HDRSO-Baier', 'HDRSO-Baier', 'XDL Monocular Rangefinder', 'Misc crate'),
        ]:
            query(search, name)
            loot = dossier.locator('[data-domain="loot"]')
            expect(loot.locator('.dossier-fact').filter(has_text=item)).to_have_count(1)
            expect(loot).to_contain_text(container)
            verify_layout()
            page.evaluate('window.scrollTo(0,0)')
            page.screenshot(path=f'/tmp/verse-lab-hurston-loot-{name.split()[0]}-{device}.png', full_page=True)
        for name, points, weapons in [('HDRSO-Bardie', 16, True), ('HDRSO-Brel', 11, False), ('HDRSO-Pearce', 20, True)]:
            query(name, name)
            loot = dossier.locator('[data-domain="loot"]')
            expect(loot).to_contain_text(f'{points} puntos de botín')
            count = 1 if weapons else 0
            expect(loot.locator('.dossier-fact').filter(has_text='P8-SC SMG')).to_have_count(count)
            navigation = dossier.locator('[data-domain="navigation"]')
            navigation.locator('summary').click()
            expect(navigation).to_contain_text('Puesto inactivo y acceso prohibido')
            verify_layout()
            page.evaluate('window.scrollTo(0,0)')
            page.screenshot(path=f'/tmp/verse-lab-hdrso-{name}-{device}.png', full_page=True)
        for name, loot_text, access_text in [
            ('HDRSO-Sims', '11 puntos de botín', 'Puesto inactivo y acceso prohibido'),
            ('ArcCorp Security Post 108', '11 puntos de botín', 'Acceso restringido a personal y contratistas'),
            ('Onyx Facility S4B1', 'Corbel Smolder', 'Acceso mediante marcador de misión'),
            ('Onyx Facility S4C9', 'Fresnel Energy LMG', 'Acceso mediante marcador de misión'),
        ]:
            query(name, name)
            expect(dossier.locator('[data-domain="loot"]')).to_contain_text(loot_text)
            navigation = dossier.locator('[data-domain="navigation"]')
            if navigation.get_attribute('open') is None:
                navigation.locator('summary').click()
            expect(navigation.get_by_text(access_text, exact=True)).to_be_visible()
            verify_layout()
            page.evaluate('window.scrollTo(0,0)')
            path_name = name.lower().replace(' ', '-')
            page.screenshot(path=f'/tmp/verse-lab-stanton30-{path_name}-{device}.png', full_page=True)
        for name, loot_text, access_text in [
            ('Onyx Facility S1A1', 'Corbel Smolder', 'Acceso mediante marcador de misión'),
            ('ArcCorp Security Post 111', 'P8-SC SMG', 'Zona de intrusión documentada'),
            ('MT SecurityCenter 6EE-GVH-9', 'XDL Monocular Rangefinder', 'Zona de intrusión documentada'),
        ]:
            query(name, name)
            expect(dossier.locator('[data-domain="loot"]')).to_contain_text(loot_text)
            navigation = dossier.locator('[data-domain="navigation"]')
            if navigation.get_attribute('open') is None:
                navigation.locator('summary').click()
            expect(navigation.get_by_text(access_text, exact=True)).to_be_visible()
            verify_layout()
            page.evaluate('window.scrollTo(0,0)')
            file_name = name.lower().replace(' ', '-')
            page.screenshot(path=f'/tmp/verse-lab-stanton110-{file_name}-{device}.png', full_page=True)
        for short_name, title, domain, expected in [
            ('kareah', 'Security Post Kareah', 'loot', '69 puntos de botín'),
            ('icebreaker', 'The Icebreaker', 'missions', '20,3 km'),
            ('private-claim', 'Mining Claim #031-L6W', 'navigation', 'Concesión privada sin destino de salto directo'),
        ]:
            query(title, title)
            section = dossier.locator(f'[data-domain="{domain}"]')
            if domain == 'navigation' and section.get_attribute('open') is None:
                section.locator('summary').click()
            expect(section).to_contain_text(expected)
            verify_layout()
            page.evaluate('window.scrollTo(0,0)')
            page.screenshot(path=f'/tmp/verse-lab-stanton200-{short_name}-{device}.png', full_page=True)
        for short_name, title, domain, expected in [
            ('tobin', 'Tobin Center', 'missions', 'Exposición IAE 2956'),
            ('gundo', 'Covalex Shipping Hub Gundo', 'navigation', 'entrada en EVA'),
            ('ecn', 'Comm Array ST1-02', 'navigation', 'Cobertura de comunicaciones ECN'),
        ]:
            query(title, title)
            section = dossier.locator(f'[data-domain="{domain}"]')
            if domain == 'navigation' and section.get_attribute('open') is None:
                section.locator('summary').click()
            expect(section).to_contain_text(expected)
            verify_layout()
            page.evaluate('window.scrollTo(0,0)')
            page.screenshot(path=f'/tmp/verse-lab-stanton-ecn-{short_name}-{device}.png', full_page=True)
        query('Tobin Center', 'Tobin Center')
        expect(page.locator('#locationMeta')).to_contain_text('Centro de exposiciones')
        for short_name, title, domain, expected in [
            ('wiley', 'Wiley Flats', 'navigation', 'Marcador de salto en el cuerpo padre'),
            ('arc-l3-clinic', 'ARC-L3 Modern Express Clinic', 'services', 'Punto de regeneración hospitalaria'),
        ]:
            query(title, title)
            section = dossier.locator(f'[data-domain="{domain}"]')
            if domain == 'navigation' and section.get_attribute('open') is None:
                section.locator('summary').click()
            expect(section).to_contain_text(expected)
            verify_layout()
            page.evaluate('window.scrollTo(0,0)')
            page.screenshot(path=f'/tmp/verse-lab-stanton-navigation-{short_name}-{device}.png', full_page=True)
        for short_name, title, expected in [
            ('magnus', 'Stanton - Magnus Jump Point', 'Antiguo punto de salto a Magnus'),
            ('palomar', 'HDOF-Palomar', 'búnker de Hurston Dynamics Operations Facility'),
            ('arc-l1a', 'ARC L1-A', 'El centro de la bolsa ARC L1-A figura a unos 20 km'),
            ('jump-wreck', 'Stanton-Pyro Jump Point Wreck Site', 'unos 632 km en línea recta de Pyro Gateway'),
        ]:
            query(title, title)
            section = dossier.locator('[data-domain="navigation"]')
            if section.get_attribute('open') is None:
                section.locator('summary').click()
            expect(section).to_contain_text(expected)
            verify_layout()
            page.evaluate('window.scrollTo(0,0)')
            page.screenshot(path=f'/tmp/verse-lab-stanton-review-{short_name}-{device}.png', full_page=True)
        query('Echo Isle', 'Echo Isle')
        expect(dossier.locator('[data-domain="missions"]')).to_contain_text('Posible destino de un encargo de Ruto')
        verify_layout()
        page.evaluate('window.scrollTo(0,0)')
        page.screenshot(path=f'/tmp/verse-lab-stanton-echo-isle-{device}.png', full_page=True)
        page.locator('#q').fill('Prospect Point')
        page.locator('#suggestions button').filter(has_text='8a55463e').click()
        navigation = dossier.locator('[data-domain="navigation"]')
        if navigation.get_attribute('open') is None:
            navigation.locator('summary').click()
        expect(navigation).to_contain_text('Esta variante carece de posición')
        verify_layout()
        page.evaluate('window.scrollTo(0,0)')
        page.screenshot(path=f'/tmp/verse-lab-stanton-prospect-{device}.png', full_page=True)
        navigation.get_by_role('button', name=re.compile(r'^Prospect Point')).click()
        expect(page.locator('#mainIntelLocation')).to_contain_text('Prospect Point')
        expect(dossier).not_to_contain_text('Esta variante carece de posición')
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
