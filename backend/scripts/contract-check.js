/* eslint-disable */
// npm run contract:check
// Compara las rutas y métodos del contrato (backend/contracts/alojamientos-openapi.yaml) con el OpenAPI
// generado (docs/openapi.json de la raíz, prefijo /api/v1). Falla (exit 1) si falta alguna operación.
// Sin dependencias: lee el YAML por indentación (paths a 2 espacios, métodos a 4).
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..', '..');
const yaml = fs.readFileSync(path.join(__dirname, '..', 'contracts', 'alojamientos-openapi.yaml'), 'utf8').split(/\r?\n/);
const generado = JSON.parse(fs.readFileSync(path.join(raiz, 'docs', 'openapi.json'), 'utf8'));
const PREFIJO = '/api/v1';
const METODOS = ['get', 'post', 'put', 'patch', 'delete'];

const contrato = [];
let enPaths = false;
let rutaActual = null;
for (const linea of yaml) {
  if (/^paths:\s*$/.test(linea)) { enPaths = true; continue; }
  if (enPaths && /^\S/.test(linea)) break; // terminó la sección paths
  if (!enPaths) continue;
  const ruta = /^ {2}(\/\S*):\s*$/.exec(linea);
  if (ruta) { rutaActual = ruta[1]; continue; }
  const metodo = /^ {4}(\w+):\s*$/.exec(linea);
  if (metodo && rutaActual && METODOS.includes(metodo[1])) contrato.push({ ruta: rutaActual, metodo: metodo[1] });
}

const faltan = contrato.filter(({ ruta, metodo }) => !(generado.paths[PREFIJO + ruta] || {})[metodo]);
for (const { ruta, metodo } of contrato) {
  const ok = !faltan.some((f) => f.ruta === ruta && f.metodo === metodo);
  console.log(`${ok ? 'OK   ' : 'FALTA'} ${metodo.toUpperCase().padEnd(6)} ${ruta}`);
}
console.log(`\n${contrato.length - faltan.length}/${contrato.length} operaciones del contrato implementadas.`);
if (!contrato.length) { console.error('No se pudo leer ninguna ruta del YAML'); process.exit(1); }
if (faltan.length) process.exit(1);
