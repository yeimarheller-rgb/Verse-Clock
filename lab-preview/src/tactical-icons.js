const svgNS = 'http://www.w3.org/2000/svg';

export const tacticalIcons = {
  fighter: ['Caza ligero', 'info', 'Naves y logística', 'M16 3l4 10 8 7v5l-9-4-3 7-3-7-9 4v-5l8-7z M16 9v9 M8 18v4m16-4v4'],
  capital: ['Nave capital', 'info', 'Naves y logística', 'M16 2l6 6v6l5 4v9h-6v3H11v-3H5v-9l5-4V8z M12 10h8v12h-8z M16 5v3m0 5v6 M8 20v4m16-4v4 M14 25v3m4-3v3'],
  repair: ['Reparación', 'service', 'Naves y logística', 'M11 4l3 7 6 5v3l-6-2-3 5-3-5-5 2v-3l5-5z M20 24l4-4a5 5 0 0 1 5-6l-3 3 2 2 3-3a5 5 0 0 1-5 6l-5 6a2 2 0 1 1-3-3z'],
  rearm: ['Rearme', 'service', 'Naves y logística', 'M10 3l3 7 5 5v3l-5-2-3 5-3-5-5 2v-3l5-5z M18 25l3-5 4-4 3-1-1 3-4 5z M22 28l3-5 4-4 3-1-1 3-4 5z'],
  refuel: ['Repostaje', 'service', 'Naves y logística', 'M10 3l3 7 5 5v3l-5-2-3 5-3-5-5 2v-3l5-5z M25 13c-2 4-5 6-5 10a5 5 0 0 0 10 0c0-4-3-6-5-10z M23 24l1 2'],
  hangar: ['Hangar', 'service', 'Naves y logística', 'M3 28V10l13-6 13 6v18z M8 28V13h16v15 M8 17h16 M16 19l2 4 4 3h-4l-2 2-2-2h-4l4-3z'],
  landing: ['Plataforma de aterrizaje', 'service', 'Naves y logística', 'M11 5h10l8 8v6l-8 8H11l-8-8v-6z M11 10v12m10-12v12m-10-6h10 M16 2v3m0 22v3 M1 16h2m26 0h2'],
  pvp: ['PvP', 'danger', 'Combate', 'M3 9l6 2 3 5-3 5-6 2 2-7z M29 9l-6 2-3 5 3 5 6 2-2-7z M14 8h4m-2-2v4m-2 14h4m-2-2v4 M15 16h2'],
  pve: ['PvE', 'warning', 'Combate', 'M16 17l3 6 5 5-5-1-3 3-3-3-5 1 5-5z M4 7l3-3 4 3v4l-4 2-3-2z M21 7l4-3 3 3v4l-3 2-4-2z M14 5l2-2 2 2v4l-2 2-2-2z M7 16v2m18-2v2m-9-5v2'],
  danger: ['Zona peligrosa', 'danger', 'Combate', 'M16 4l13 23H3z M9 23h14 M16 11v6m0 3v1'],
  contested: ['Zona disputada', 'danger', 'Combate', 'M3 11V6l4-3h5m8 0h5l4 3v5m0 10v5l-4 3h-5m-8 0H7l-4-3v-5 M9 11l14 10M23 11L9 21 M7 13V9h4m10 0h4v4m0 6v4h-4m-10 0H7v-4'],
  fps: ['Combate FPS', 'danger', 'Combate', 'M6 9V6l3-3h5l3 3v5h-4l-1 3H8l-2-2z M7 15l-3 3v8l3-1 1-6m1-4l5 2 3 3h5v4h-7l-4-3v5l4 3m-7 0v-4 M19 17h10v3h-8m6-3v-2m-6 8l2 3'],
  space: ['Combate espacial', 'danger', 'Combate', 'M3 22l6-7 8 1-4 5-4 1-2 5-4 2z M20 3l6 2 3 7-5 1-4-4-5 1z M15 11l2 2m4 3l-2 3 M3 5h4m-2-2v4m21 16h4m-2-2v4'],
  aa: ['Defensa antiaérea', 'danger', 'Combate', 'M5 28h22l-3-5H8z M10 23v-4h9v4 M12 19l8-12 2 1-6 11 M18 18l8-12 2 1-7 12 M5 13a10 10 0 0 1 8-8M6 9l-3 4 4 1'],
  turret: ['Torreta', 'danger', 'Combate', 'M4 27h24l-2-4H6z M10 23v-4l3-3h7l3 3v4 M14 16v-3h5v3 M19 13l8-7 2 2-8 8 M9 14a8 8 0 0 1 10-5'],
  loot: ['Botín', 'info', 'Exploración y recursos', 'M3 12l3-5h20l3 5v13H3z M3 13h26 M8 8v16m16-16v16 M13 13v5h6v-5 M6 22h2m16 0h2'],
  weapons: ['Armas', 'warning', 'Exploración y recursos', 'M3 12h5l3-3h9v3h6v2h4v3h-9l-2 3h-4l2 5h-5l-2-7H7l-2 3H2v-8z M12 6h6l2 3 M14 18h4'],
  mining: ['Minería', 'info', 'Exploración y recursos', 'M4 12l3-5 7-3 6 2 3 5-8-3-5 2z M13 10l2 2-9 15-3-2z M19 23l3-9h4l4 8-5 7h-5z M22 14l3 9v6m-6-6h6l5-1'],
  valakkar: ['Valakkar', 'danger', 'Exploración y recursos', 'M4 28c1-7 6-5 8-10l1-4-2-5 3 1-1-5 4 2 2-5 3 4 5-2-1 5 4 2-4 2-3 5-4 1c-2 6-5 8-8 9z M15 11l4-2 6 1-3 4-4 1z M11 21l4 2m-7 1l2 3m4-10l4 2'],
  cave: ['Cueva', 'warning', 'Exploración y recursos', 'M2 27l5-13 8-9 7 3 8 19z M9 27l2-8 4-5 5 3 3 10 M7 14l5-1m10-5l-3 5m3 7l4 1'],
  bunker: ['Búnker', 'info', 'Exploración y recursos', 'M3 25v-9l6-7h14l6 7v9z M3 16h26 M11 25v-6h10v6 M6 20h2m16 0h2 M13 12h6'],
  distribution: ['Centro de distribución', 'info', 'Exploración y recursos', 'M3 27V13l5-4 5 4 5-4 5 4 6-4v18z M5 18h22 M7 21h5v6m3-6h5v6m3-6h3v6 M23 9V5h4v5'],
  trade: ['Comercio', 'info', 'Exploración y recursos', 'M3 11h23l-4-4m4 4l-4 4 M29 21H6l4-4m-4 4l4 4 M13 4h6v3m-6 18v3h6v-3'],
  commodity: ['Terminal de mercancías', 'info', 'Exploración y recursos', 'M5 5h22v17H5z M10 9l6-2 6 2v7l-6 3-6-3z M10 9l6 3 6-3m-6 3v7 M12 22v5h8v-5 M9 27h14'],
  mission: ['Contrato', 'info', 'Interfaz', 'M7 5h13l5 5v19H7z M20 5v6h5 M11 12h5m-5 5h10m-10 5h7'],
  intel: ['Ficha de inteligencia', 'info', 'Interfaz', 'M3 16s5-8 13-8 13 8 13 8-5 8-13 8S3 16 3 16z M16 12a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'],
  medic: ['Clínica', 'service', 'Interfaz', 'M12 4h8v8h8v8h-8v8h-8v-8H4v-8h8z'],
  refinery: ['Refinería', 'service', 'Interfaz', 'M3 28h26 M6 28V12l3-5 3 5v16m8 0V8l3-5 3 5v20 M12 17h8m-8 5h8'],
  cargo: ['Centro de carga', 'service', 'Interfaz', 'M4 27V5h24 M4 9h22 M23 9v8l-3 2-3-2m-7 5h17v6H10z'],
};

export const tacticalStates = {
  confirmed: ['Confirmado', 'M3 6l2 2 4-5'],
  possible: ['Posible', 'M6 3v4m0 2v.5'],
  unknown: ['Desconocido', 'M4 4a2 2 0 1 1 3 2l-1 1m0 2v.5'],
  unavailable: ['No disponible', 'M3 3l6 6m0-6L3 9'],
};

export function tacticalIcon(name, {size = 24, state} = {}) {
  const entry = tacticalIcons[name];
  if (!entry) throw new RangeError('Icono táctico desconocido: ' + name);
  const svg = document.createElementNS(svgNS, 'svg');
  for (const [key, value] of Object.entries({
    viewBox: '0 0 32 32', width: size, height: size, class: 'tactical-icon',
    'aria-hidden': 'true', focusable: 'false', 'data-icon': name, 'data-tone': entry[1],
  })) svg.setAttribute(key, value);
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', entry[3]);
  svg.append(path);
  if (tacticalStates[state]) {
    svg.dataset.state = state;
    const badge = document.createElementNS(svgNS, 'g');
    badge.setAttribute('class', 'tactical-icon-state');
    badge.setAttribute('transform', 'translate(20 1)');
    const backing = document.createElementNS(svgNS, 'rect');
    backing.setAttribute('width', '11');backing.setAttribute('height', '11');backing.setAttribute('rx', '2');
    const mark = document.createElementNS(svgNS, 'path');
    mark.setAttribute('d', tacticalStates[state][1]);
    badge.append(backing, mark);
    svg.append(badge);
  }
  return svg;
}
