const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const shortName = value => typeof value === 'string' && Boolean(value.trim()) && value.length < 140;
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
