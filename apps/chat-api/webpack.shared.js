/** Webpack warnings emitted when bundling NestJS/Express for Node — safe to ignore. */
const NESTJS_IGNORED_WARNINGS = [
  /Critical dependency: the request of a dependency is an expression/,
  /Module not found: Error: "\." is not exported under the conditions .*file-type/,
];

/** Optional NestJS/Express modules that are resolved dynamically at runtime. */
const NESTJS_RESOLVE_ALIASES = {
  '@nestjs/websockets/socket-module': false,
  '@nestjs/microservices/microservices-module': false,
  '@nestjs/microservices': false,
  'class-transformer/storage': false,
  /* Webpack resolves `class-transformer` to its `esm5` build via the "module"
   * field, while `@nestjs/mapped-types` (IntersectionType/PartialType/…)
   * reads `class-transformer/cjs/storage`. Two module copies mean two
   * metadata storages, so `@Transform` decorators were not inherited by
   * composed classes such as `EnvironmentVariables`. Pin one copy. */
  'class-transformer$': require.resolve('class-transformer/cjs/index.js'),
  '@fastify/static': false,
};

module.exports = {
  NESTJS_IGNORED_WARNINGS,
  NESTJS_RESOLVE_ALIASES,
};
