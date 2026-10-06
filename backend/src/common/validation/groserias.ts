/**
 * Lista corta de groserías e insultos en español (Ecuador y región) para el control automático de reseñas.
 * Se comparan SIN tildes ni mayúsculas (la ñ se conserva) y por palabra completa (también en plural: +s / +es).
 * Para ampliarla basta con agregar palabras aquí, en minúsculas y sin tildes.
 * El frontend tiene una copia idéntica en frontend/src/app/shared/groserias.ts (validación en vivo).
 */
export const GROSERIAS: readonly string[] = [
  'mierda', 'puta', 'puto', 'putas', 'hijueputa', 'hijoeputa', 'hdp', 'malparido', 'malparida',
  'pendejo', 'pendeja', 'cabron', 'cabrona', 'verga', 'chucha', 'carajo', 'coño',
  'huevon', 'huevona', 'guevon', 'guevona', 'maricon', 'marica', 'imbecil', 'idiota',
  'estupido', 'estupida', 'gonorrea', 'culero', 'culera', 'joder', 'jodido', 'jodida',
  'mamaverga', 'chuchasumadre', 'longo',
];
