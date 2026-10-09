import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'test-results/**', 'playwright-report/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  { rules: { 'no-empty': ['error', { allowEmptyCatch: true }] } },
);
