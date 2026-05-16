/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: [require.resolve('./base.js')],
  env: { node: true, es2022: true },
  rules: {
    'no-process-exit': 'error',
  },
};
