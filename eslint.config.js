import { defineConfig, globalIgnores } from 'eslint/config';
import react from 'eslint-config-zakodium/react';
import ts from 'eslint-config-zakodium/ts';
import unicorn from 'eslint-config-zakodium/unicorn';

export default defineConfig(
  globalIgnores(['android', 'coverage', 'dist', 'legacy', 'parity-out']),
  ts,
  unicorn,
  react,
);
