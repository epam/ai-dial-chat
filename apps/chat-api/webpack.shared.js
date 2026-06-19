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
  '@fastify/static': false,
};

module.exports = {
  NESTJS_IGNORED_WARNINGS,
  NESTJS_RESOLVE_ALIASES,
};
