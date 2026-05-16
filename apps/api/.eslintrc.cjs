module.exports = {
  root: true,
  extends: ['@jobpilot/config/eslint/node'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
