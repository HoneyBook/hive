const { siblingMockResolver, mocksDirResolver } = require("@honeybook/hive-mock-adapter-jest");

module.exports = function (request, options) {
  const real = options.defaultResolver(request, options);
  if (!real.endsWith(".ts") && !real.endsWith(".tsx")) return real;
  return siblingMockResolver(real) ?? mocksDirResolver(real) ?? real;
};
