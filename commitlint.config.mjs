// Convenção `tipo(frente): texto (#issue)` (kit/CLAUDE.md). O CI roda isto no intervalo do PR:
// o hook local pode ser pulado, o CI não.
const configuracao = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-case': [0],
    'header-max-length': [2, 'always', 120],
  },
};

export default configuracao;
