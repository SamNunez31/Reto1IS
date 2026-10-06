/** Log estructurado en una línea JSON. Nunca recibe contraseñas, tokens ni cuerpos completos. */
export function logJson(level: 'info' | 'warn' | 'error', msg: string, campos: Record<string, unknown> = {}): void {
  const linea = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...campos });
  if (level === 'error') console.error(linea);
  else console.log(linea);
}
