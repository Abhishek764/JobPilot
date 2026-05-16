/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: [require.resolve('./base.js'), 'next/core-web-vitals'],
  env: { browser: true, node: true, es2022: true },
  rules: {
    'react/no-unescaped-entities': 'off',
    '@next/next/no-html-link-for-pages': 'off',
  },
};
