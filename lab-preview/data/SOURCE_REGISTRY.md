# Fuentes de inteligencia — VERSE CLOCK LAB

Actualizado: 2026-11-21. Registro de candidatos; **no implica ingestión ni permiso de reutilización**.

| Fuente | URL | Dominio útil | Método | Precaución |
|---|---|---|---|---|
| Star Citizen Wiki API | https://docs.star-citizen.wiki/ | Ubicaciones, misiones, armas, recursos, versiones | REST JSON /api/locations, /api/missions, /api/items, /api/game-versions/default | Fijar versión, paginar y conservar UUID/URL; API comunitaria, no prueba de servicios LIVE |
| Loot Verse | https://loot-verse.com/ | Botín, armas, armaduras, componentes y lugares de aparición | Explorar exportación o API pública documentada **antes** de integrar | No asumir API ni permiso de scraping; probabilidades estimadas, no drops garantizados |
| SC-Toolbox | https://sc-toolbox.com/ | Misiones, planos, minería, recompensas | Evaluar exportación/API y condiciones de reutilización | No asumir endpoints públicos ni licencia de datos |
| RSI Known Issues | https://support.robertsspaceindustries.com/hc/en-us/articles/360056254754-Star-Citizen-Alpha-4-10-3-Known-Issues | Problemas conocidos | Enlace documental | Aviso general no demuestra fallo de una ubicación |

## Reglas de ingestión

1. Guardar por dato: `sourceUrl`, `sourcePatch`, `retrievedAt`, `evidenceScope`, `verification` y, si existe, identificador original.
2. No unir por nombre solamente: distinguir sistemas, planetas, variantes OLP/PAF y gateways homónimos.
3. Diferenciar `location-listed`, `category-wide`, `historical`, `live-verified` y `unverified`.
4. Nunca convertir «posible botín», «servicio catalogado» o «misión de categoría» en garantía por instancia.
5. No importar masivamente de fuentes sin verificar condiciones de uso.
6. Los indicadores de PvP son riesgo cualitativo documentado, nunca detección de jugadores en tiempo real.

## Primer conector recomendado

Usar la API Wiki como fuente estructurada inicial: consultar `/api/game-versions/default`, fijar `version`, paginar `/api/locations`, unir por UUID y conservar la respuesta original para auditoría. Integrar misiones solo cuando el vínculo ubicación–misión sea explícito. Mantener fuentes de botín y comercio separadas hasta validar licencias y formatos.
