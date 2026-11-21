# Auditoría de cobertura — VERSE CLOCK LAB (2026-11-21)

Fuente: `lab-preview/data/atlas-meta.json`, versión declarada `4.10.3-LIVE.13165946`, generado 2026-11-20 20:16 UTC. Estas cifras describen el artefacto generado, **no** una validación en servidor LIVE. El archivo completo `atlas-enriched.json` no se pudo inspeccionar íntegramente mediante el lector disponible; se utiliza el resumen generado y se señala la limitación.

| Indicador | Registros | % del catálogo (2017) |
|---|---:|---:|
| Geográficos sin datos accionables | 1757 | 87,1 % |
| Accionables según el generador | 260 | 12,9 % |
| PvE | 16 | 0,8 % |
| PvP | 0 | 0,0 % |
| Misiones | 6 | 0,3 % |
| Botín | 16 | 0,8 % |
| Armas | 12 | 0,6 % |
| Comercio | 0 | 0,0 % |
| Peligros | 16 | 0,8 % |
| Servicios | 10 | 0,5 % |
| Recursos | 233 | 11,6 % |

**Precaución:** 228 fichas tienen solo asociaciones de recursos; no equivalen a ubicaciones con información operativa contrastada. El generador contabiliza 32 registros operativos excluyendo dichas asociaciones. La presencia de una URL de fuente en 2017 fichas no demuestra que los siete dominios tácticos estén documentados.

## Brechas concretas

1. **Hathor:** el resumen de investigación contabiliza 0 fichas Hathor. La semilla curada consultada no contiene coincidencias de Hathor/Hator por nombre. Es un hueco prioritario; no inventar fases de misión, botín, enemigos ni horarios.
2. **Estaciones:** el resumen de investigación contiene 473 estaciones, pero solo 10 ubicaciones del atlas declaran servicios; no inferir reparación, rearme, inventario ni comercio por tener pad o tienda catalogada.
3. **PvP:** 0 fichas con inteligencia PvP según el resumen. No interpretar como ausencia de jugadores ni como zona segura.
4. **Lazarus Complex / Valakkar:** existe una semilla con ese nombre, pero una ficha catalogada no prueba que estén documentadas mecánicas de combate, spawn o recompensas para el parche LIVE.

## Orden de ejecución y criterio de aceptación

- Incorporar por ubicación referencias concretas con URL, parche, fecha de consulta y ámbito de evidencia (sitio específico frente a categoría genérica).
- Priorizar Hathor, Grim HEX, Orbituary, Lazarus y estaciones de tránsito; comprobar fuentes oficiales del parche y contrastar inventarios con fuentes secundarias.
- Mostrar en la interfaz qué hacer, cómo acceder, riesgos PvE/PvP, botín, misiones, servicios y limitaciones **solo** cuando haya evidencia; mostrar «No verificado» en otro caso.
- Ejecutar pruebas de integridad y navegador; conservar producción estable intacta hasta disponer de evidencias y revisión visual.

**Estado:** auditoría documental, no certificado de completitud ni verificación de jugabilidad LIVE.
