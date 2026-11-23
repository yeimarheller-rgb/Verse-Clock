const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const shortName = value => typeof value === 'string' && Boolean(value.trim()) && value.length < 140;
export const registryUncertainty = 'La afirmación procede de la ficha del mapa incluida en el parche. La actividad, el estado de la instalación y el acceso físico requieren comprobación en partida.';
export const navigationUncertainty = 'Configuración del mapa extraída del parche. La visibilidad durante una misión y el acceso físico requieren comprobación en partida.';

export function stantonNavigationText(detail, name) {
 if (!shortName(name) || !detail || !uuid.test(detail.referenceUuid) || !shortName(detail.referenceName)) return '';
 const {mode, referenceName, arrivalMeters, distanceKm} = detail;
 if (mode === 'direct' && (arrivalMeters === null || Number.isFinite(arrivalMeters) && arrivalMeters > 0)) {
  const instruction = detail.selectParent === true ? 'Selecciona ' + referenceName + ' en el mapa estelar. ' : '';
  const radius = arrivalMeters === null ? '' : ' Radio de llegada en los archivos del parche: ' + (arrivalMeters / 1000).toLocaleString('es-ES') + ' km.';
  return instruction + name + ' tiene marcador visible y salto cuántico directo configurado.' + radius;
 }
 if (mode === 'restricted' && /^Onyx Facility S\d[A-Z]\d+$/.test(name)) {
  return name + ' figura en ' + referenceName + ' con el marcador oculto. La ficha de ASD indica acceso prohibido. Consulta tu contrato para localizar el objetivo antes de salir.';
 }
 if (mode === 'clinic') {
  return 'Viaja a ' + referenceName + ' y busca allí ' + name + '. El marcador propio del centro médico está oculto en el mapa estelar.';
 }
 if (mode === 'sector') {
  const visibility = detail.hidden ? 'El marcador está oculto y carece de salto directo.' : 'El marcador es visible y carece de salto directo.';
  const sector = ' El registro ubica ' + name + ' en el sector de ' + referenceName + '. Usa esa referencia para identificar el sector antes de trazar la ruta.';
  return visibility + sector + (detail.privateAccess === true ? ' La UEE exige autorización de acceso a la concesión minera.' : '');
 }
 if (mode === 'gateway') {
  return 'Selecciona ' + referenceName + ' para aproximarte a ' + name + '. El marcador del punto de salto está oculto y carece de salto cuántico directo.';
 }
 if (mode === 'private' && /^Mining Base #/.test(name)) {
  return name + ' tiene marcador visible sin salto directo. El registro de la UEE exige autorización de acceso a esta base minera.';
 }
 if (mode === 'approach'  && Number.isInteger(distanceKm) && distanceKm > 0 && distanceKm <= 10000) {
  const direction = 'El marcador de ' + name + ' está oculto y carece de salto directo. Usa ' + referenceName + ' como referencia cuántica. Su centro queda a unos ' + distanceKm.toLocaleString('es-ES') + ' km del centro de ese destino en los archivos del parche.';
  return detail.privateAccess === true ? direction + ' El registro de la UEE exige autorización de acceso.' : direction;
 }
 return '';
}

export function stantonRegistryText(detail, name) {
 if (!shortName(name) || !detail || !uuid.test(detail.referenceUuid) || !shortName(detail.referenceName)) return '';
 const place = name + ' (' + detail.referenceName + ')';
 switch (detail.mode) {
  case 'mining-permit':
   return /^Mining (?:Base|Claim) #/.test(name) ? 'El registro de la UEE exige autorización para entrar en ' + place + '. La posición operativa está pendiente de verificación.' : '';
  case 'closed-mine':
   return /^(Reyes|Sloane) Mining Compound-[A-D]$/.test(name) ? 'La ficha de ' + place + ' declara la explotación fuera de servicio por condiciones inestables. Verifica la ubicación y la actividad antes de planificar una extracción.' : '';
  case 'restricted-post':
   return name === 'ArcCorp Security Post 017' ? 'La ficha de ' + place + ' indica que el puesto está inactivo y reserva el acceso al personal de ArcCorp y sus contratistas.' : '';
  case 'restricted-depot':
   return name === 'Operations Depot Lyria-1' ? 'La ficha de ' + place + ' reserva el acceso al personal autorizado y advierte de sanciones por entrada sin autorización.' : '';
  case 'hospital-record':
   return 'El parche registra ' + place + ' como punto hospitalario de reaparición. Comprueba el destino de la impronta en el terminal antes de depender de este punto.';
  default:
   return '';
 }
}
