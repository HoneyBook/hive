module.exports = {
  "*.{ts,js,json,md}": "prettier --write",
  "*.ts": () => "turbo run typecheck --filter='[HEAD]'",
};
