/* eslint-disable */
// npm run contract:export
// Exporta el contrato PROPIO de Posada EC: todo el OpenAPI generado desde la API real (docs/openapi.json),
// incluidas las rutas propias (auth, cuenta, /host/*, /admin/*, health) y las extensiones opcionales,
// a backend/contracts/posada-ec-openapi.yaml. El contrato oficial (alojamientos-openapi.yaml) no se modifica.
// Antes: npm run docs:openapi
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const raiz = path.join(__dirname, '..', '..');
const doc = JSON.parse(fs.readFileSync(path.join(raiz, 'docs', 'openapi.json'), 'utf8'));
doc.info = {
  ...doc.info,
  title: 'Posada EC — Alojamientos API (contrato propio)',
  description:
    'Contrato propio del servicio de Alojamientos de Posada EC. Incluye las 17 operaciones del contrato oficial ' +
    '(backend/contracts/alojamientos-openapi.yaml, sin modificar) y las rutas propias: autenticación, cuenta, ' +
    'catálogo del anfitrión/admin (/host/*), administración (/admin/*) y salud. Generado desde la API real; ' +
    'los errores usan application/problem+json (ProblemDetails).',
};
const salida = path.join(__dirname, '..', 'contracts', 'posada-ec-openapi.yaml');
const cabecera =
  '# Contrato propio de Posada EC — generado con `npm run docs:openapi` + `npm run contract:export`.\n' +
  '# No editar a mano: se regenera desde la API real. El contrato oficial es alojamientos-openapi.yaml.\n';
fs.writeFileSync(salida, cabecera + yaml.dump(doc, { lineWidth: 120, noRefs: true }), 'utf8');
const rutas = Object.keys(doc.paths).length;
const ops = Object.values(doc.paths).reduce((n, p) => n + Object.keys(p).filter((m) => ['get', 'post', 'put', 'patch', 'delete'].includes(m)).length, 0);
console.log(`Contrato propio: ${rutas} rutas, ${ops} operaciones -> backend/contracts/posada-ec-openapi.yaml`);
