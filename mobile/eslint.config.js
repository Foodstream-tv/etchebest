// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const globals = require('globals');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // The Jest setup file and the tests use Jest's globals.
    files: ['jest.setup.js', '**/__tests__/**', '**/*.test.{js,jsx,ts,tsx}'],
    languageOptions: { globals: { ...globals.jest } },
  },
  {
    // eslint-config-expo 56 turned the React Compiler checks of eslint-plugin-react-hooks into errors. The
    // code they flag works (it predates them), so they stay visible as warnings until each screen is
    // reworked, instead of blocking every build.
    rules: {
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/use-memo': 'warn',
    },
  },
]);
