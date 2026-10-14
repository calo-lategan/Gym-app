// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'test-results/*', 'playwright-report/*'],
  },
  {
    // React Three Fiber elements (<mesh>, <pointLight>...) take three.js
    // properties, which the DOM-oriented rule does not know about.
    files: ['src/game3d/**/*.tsx'],
    rules: {
      'react/no-unknown-property': 'off',
    },
  },
]);
