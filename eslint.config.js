const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: [
      'dist/*',
      'web-build/*',
      '.expo/*',
      'expo-env.d.ts',
      'node_modules/*',
      '.opencode/**',
      'assets/**',
      'scripts/**',
    ],
  },
]);
