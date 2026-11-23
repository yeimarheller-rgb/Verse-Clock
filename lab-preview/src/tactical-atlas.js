const api = 'https://api.uexcorp.uk/2.0/';
const citadel = 'https://www.citadelsc.com/es/guides/hathor';
const wiki = 'https://starcitizen.tools/';
const maintenance = 'https://support.robertsspaceindustries.com/hc/en-us/articles/360007981814-Vehicle-Maintenance-Services';
const contestedGuide = 'https://www.citadelsc.com/es/contested-zones';
const contestedWiki = 'https://starcitizen.tools/Contested_Zones';
const contestedSites = {
  Checkmate: ['Placas 1, 2 y 3.', 'Lleva fusibles y tarjetas Supervisor rojas. Dentro puedes imprimir tarjetas Security azules.'],
  Orbituary: ['Placas 4 y 7.', 'La tarjeta roja permite continuar por el ala de la clínica. El itinerario azul lleva al ascensor hacia el hangar privado.'],
  'Ruin Station': ['Placas 5 y 6 en Ghost Arena.', 'Busca la tarjeta Crypt para la sala de la placa 5. Wasteland y Last Resort abren accesos al botín de la cámara.'],
  'PYAM-SUPVISR-3-4': ['Tarjeta roja Supervisor.', 'Recógela para las puertas rojas de Checkmate y Orbituary.'],
  'PYAM-SUPVISR-3-5': ['Tarjeta roja Supervisor.', 'Recógela para las puertas rojas de Checkmate y Orbituary.'],
  'PYAM-EXHANG-0-1': ['Hangar ejecutivo · placas 1 a 7.', 'Canjea el juego completo de placas. Las fuentes documentan una nave por apertura, componentes de grado A y armas FPS raras como railguns o lanzagranadas. El contenido depende de la sesión.'],
};
const contract = 'https://api.star-citizen.wiki/missions/xl-purchase-order-hand-mined-materials-3';

export const normalize = value => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export const atlasSystem = value => String(value || '').replace(/\s+system$/i, '').trim();
export const atlasKey = p => normalize(atlasSystem(p.system)) + '|' + normalize(p.name) + (p.catalogVariant?'|'+p.catalogVariant:'');
export const serviceNames = {
  repair: 'Reparación de nave', refuel: 'Repostaje', refinery: 'Refinería',
  clinic: 'Clínica', cargo: 'Centro de carga',
};
const typeNames = {space_stations: 'Estación', outposts: 'Puesto de superficie', cities: 'Ciudad'};
const source = (name, url) => ({name, url});

export function mergeTacticalAtlas(byKey, snapshot, wikiVersion) {
  if (snapshot?.schemaVersion === 1 && Array.isArray(snapshot.locations)) {
    for (const entry of snapshot.locations) {
      if (!typeNames[entry.type] || !entry.name || !entry.system) continue;
      const key = atlasKey(entry);
      const alternateKey = entry.sourceName && atlasKey({...entry, name: entry.sourceName});
      const alternate = alternateKey && byKey.get(alternateKey);
      const existing = byKey.get(key);
      if (alternate && existing) byKey.delete(alternateKey);
      const location = existing ? {...alternate, ...existing} : {
        name: entry.name, system: entry.system, parent: entry.body, type: typeNames[entry.type],
      };
      const services = {...location.services};
      for (const label of entry.services) services[label] = 'reported';
      byKey.set(key, {...location, services, serviceIntel: {...entry, checkedAt: entry.checkedAt || snapshot.checkedAt, live: snapshot.live}});
    }
  }
  for (const [key, location] of byKey) {
    if (atlasSystem(location.system) !== 'Stanton') continue;
    const series = /^(Attritus|Lamina|Ruptura|Vivere) (OLP|PAF-(?:I|II|III))$/.exec(location.name);
    if (!series) continue;
    const [, group, site] = series;
    const moon = /^(Attritus|Lamina)$/.test(group) ? 'Daymar' : 'Aberdeen';
    const recovery = moon === 'Daymar' ? 'Shubin Mining Facility SCD-1' : 'HDMS-Anderson';
    const isPlatform = site === 'OLP';
    const linked = isPlatform ? ['I', 'II', 'III'].map(n => group + ' PAF-' + n) : [group + ' OLP'];
    const sections = [
      {title: 'Actividad · Align & Mine', icons: ['mining'], text: isPlatform
        ? 'Trae una batería GP-XP de cada PAF del mismo conjunto. Alimenta la plataforma, consigue la tarjeta de activación y dispara desde el búnker de superficie.'
        : 'Busca tarjetas azules de mantenimiento. Úsalas en el garaje doble para imprimir las rojas, abre las salas de seguridad y lleva tres Alignment Blades a la consola. Transporta la batería GP-XP al OLP.',
      sources: [source('Citadel · guía de la actividad', citadel)]},
      {title: 'PvE y peligros', icons: ['pve','valakkar','danger'], text: isPlatform
        ? 'Tras abrir la cueva de superficie, hay Valakkar juveniles y riesgo de colapso. Organiza la extracción antes de entrar.'
        : 'La guía documenta mercenarios en tierra y Valakkar juveniles durante la alineación de la antena.',
      sources: [source('Citadel · fases y amenazas', citadel)]},
      {title: 'PvP · riesgo de encuentro', icons: ['pvp'], text: 'Actividad abierta y compartida. La antena, el traslado de baterías y la extracción pueden coincidir con otros grupos. Presencia de jugadores y frecuencia sin verificar.',
      sources: [source('Citadel · acceso y recorrido', citadel)]},
      {title: isPlatform ? 'Botín · cueva de superficie' : 'Armas y botín · tabla PAF', icons: isPlatform ? ['cave','loot'] : ['weapons','loot'], text: isPlatform
        ? 'Carinite, Jaclium y Saldynium se documentan en la cueva abierta por el láser. La extracción y los nodos dependen de la sesión.'
        : 'Posibles S71 Justified, C54 Luckbringer, Karna Rager y Pulverizer LMG. La tabla corresponde al tipo de instalación. Comprueba las cajas de las salas de seguridad.',
      sources: [isPlatform ? source('Citadel · minerales', citadel) : source('Star Citizen Wiki · tabla de botín PAF', wiki + 'Planetary_alignment_facilities')]},
      {title: 'Contrato relacionado · Shubin', icons: ['mission'], text: 'XL Purchase Order: Hand Mined Materials. El pedido menciona Hathor en Daymar y Aberdeen como origen de materiales. Consulta la oferta en el gestor de contratos.',
      sources: [source('Star Citizen Wiki API · contrato', contract)]},
    ];
    if (byKey.get(atlasKey({system: location.system, name: recovery}))?.serviceIntel?.services.includes('repair')) {
      sections.push({title: 'Reparación en la misma luna', icons: ['repair'], text: recovery + ' tiene reparación de nave registrada por UEX. Comprueba el tamaño de la plataforma y la disponibilidad al aterrizar.',
        destinations: [recovery], sources: [source('Star Citizen Wiki · servicios del puesto', wiki + recovery.replaceAll(' ', '_'))]});
    }
    byKey.set(key, {...location, hathor: {moon, group, linked, sections}, patch: wikiVersion || location.patch});
  }
}

export function tacticalSections(p) {
  if (p.hathor) return p.hathor.sections;
  const sections = [...(p.pyroIntel?.sections || [])];
  const intel = p.serviceIntel;
  const contested = p.system === 'Pyro' ? contestedSites[p.name] : null;
  if (contested) {
    sections.push({title: 'Zona disputada · PvPvE', icons: ['contested'], text: 'Acceso de fuego libre en el recinto disputado. Puedes encontrar NPC hostiles y otros jugadores. En estaciones, localiza el acceso específico a la zona disputada desde la zona de servicios.',
      sources: [source('Star Citizen Wiki · mecánica PvPvE', contestedWiki)]});
    sections.push({title: 'Botín y acceso · Hangar ejecutivo', icons: ['loot','hangar'], text: contested.join(' '),
      sources: [source('Citadel · mapa y tarjetas', contestedGuide), source('Star Citizen Wiki · recompensas', contestedWiki)]});
  }
  if (!intel) return sections;
  const uex = source('UEX · ' + (intel.sourceName || intel.name) + ' · #' + intel.id + ' en ' + intel.type, api + intel.type);
  if (intel.services.length) {
    const hasLandingServices = intel.services.includes('repair') || intel.services.includes('refuel');
    const services = intel.services.map(key => serviceNames[key]).join(' · ');
    const pads = intel.padTypes ? ' Plataformas registradas: ' + intel.padTypes.replaceAll(',', ', ') + '.' : '';
    const how = hasLandingServices ? ' Aterriza y abre los servicios de aterrizaje desde el mobiGlas en el asiento de piloto.' : '';
    sections.push({title: 'Servicios registrados', icons: [], text: services + '.' + pads + how,
      sources: hasLandingServices ? [uex, source('RSI · servicios de mantenimiento', maintenance)] : [uex]});
  }
  if (intel.tradeTerminal || intel.trade?.length) {
    const named = (intel.trade || []).map(([id, name, version]) => name + ' (UEX #' + id + (version ? ', registro ' + version : '') + ')');
    sections.push({title: 'Comercio', icons: ['trade','commodity'], text: named.length
      ? named.join(' · ') + '. Consulta existencias y precios en el terminal.'
      : 'Terminal de mercancías registrado. Consulta existencias y precios en el lugar.',
    sources: [named.length ? source('UEX · catálogo de terminales', api + 'terminals') : uex]});
  }
  return sections;
}

export function tacticalTags(p) {
  return [
    p.hathor && 'Hathor Align & Mine alineación láser',
    p.serviceIntel?.sourceName,
    p.serviceIntel?.body,
    p.hathor && (/OLP$/.test(p.name) ? 'cueva' : 'armas botín'),
    ...(p.serviceIntel?.services || []).map(s => serviceNames[s]),
    ...tacticalSections(p).map(s => s.title + ' ' + s.text),
  ].filter(Boolean);
}
