#!/usr/bin/env sh
# Descarga las fuentes (licencia OFL) desde npm con versión fijada y las deja en fonts/. Se ejecuta en CI.
set -e
TMP=$(mktemp -d); mkdir -p fonts
cd "$TMP"
npm pack -q @fontsource/orbitron@5.2.8 @fontsource/rajdhani@5.3.0 >/dev/null
for f in *.tgz; do tar xzf "$f"; mv package "${f%.tgz}"; done
cd - >/dev/null
cp "$TMP"/fontsource-orbitron-5.2.8/files/orbitron-latin-700-normal.woff2 fonts/orbitron-700.woff2
for w in 500 600 700; do cp "$TMP"/fontsource-rajdhani-5.3.0/files/rajdhani-latin-$w-normal.woff2 fonts/rajdhani-$w.woff2; done
cp "$TMP"/fontsource-orbitron-5.2.8/LICENSE fonts/OFL-orbitron.txt 2>/dev/null || true
cp "$TMP"/fontsource-rajdhani-5.3.0/LICENSE fonts/OFL-rajdhani.txt 2>/dev/null || true
ls fonts
