# Verse Clock

Hora local, amanecer y anochecer de bases de superficie de Star Citizen (Stanton y Pyro), calculados en el dispositivo a partir del reloj UTC. PWA instalable en iPhone y Android.

- Motor: `src/engine.js`, adaptado de [VerseTime](https://github.com/dydrmr/VerseTime) (dydrmr). Licencia GPL-3.0.
- Catálogo: `data/locations.json` se genera en cada despliegue desde VerseTime (commit fijado en el workflow) con `tools/build-data.mjs`. No se guarda en el repo.
- Escena: `src/scene.js` dibuja un paisaje procedural (visualización artística) cuyo color y sol siguen la fase solar del motor. `?t=2026-11-04T22:02:00Z` simula otro instante.
- Fotos de fondo: originales en `img/src/` (`night|sunrise|day|sunset` + `-wide|-tall`). El CI las convierte a WebP en `img/bg/` con `tools/build-images.py` y la web hace un fundido entre ellas según la elevación solar. Si falta alguna, se usa la escena procedural.
- Explorador: [abrir buscador de ubicaciones](./explorer/) — interfaz para filtrar el catálogo por nombre, sistema, cuerpo y tipo de lugar.
- Fuentes: Orbitron y Rajdhani (OFL), descargadas en CI con `tools/fetch-fonts.sh`.
- ChatGPT: `chatgpt/` contiene el script Python y las instrucciones para un GPT personalizado.
- Tests: `node --test tests/*.test.mjs`.

Es una predicción del modelo, no una lectura del servidor del juego.
