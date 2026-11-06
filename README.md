# Verse Clock

Hora local, amanecer y anochecer de bases de superficie de Star Citizen (Stanton y Pyro), calculados en el dispositivo a partir del reloj UTC. PWA instalable en iPhone y Android.

- Motor: `src/engine.js`, adaptado de [VerseTime](https://github.com/dydrmr/VerseTime) (dydrmr). Licencia GPL-3.0.
- Catálogo: `data/locations.json` se genera en cada despliegue desde VerseTime (commit fijado en el workflow) con `tools/build-data.mjs`. No se guarda en el repo.
- ChatGPT: `chatgpt/` contiene el script Python y las instrucciones para un GPT personalizado.
- Tests: `node --test tests/*.test.mjs`.

Es una predicción del modelo, no una lectura del servidor del juego.
