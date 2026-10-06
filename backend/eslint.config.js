// @ts-check
// ESLint (flat config) del backend: reglas recomendadas de ESLint y typescript-eslint.
// `npm run lint` solo revisa (sin --fix).
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'scripts/**'] },
  {
    files: ['**/*.ts'],
    extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      // Se descartan campos con desestructuración: const { password_hash: _a, ...resto } = fila
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
);
