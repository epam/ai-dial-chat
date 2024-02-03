const devkit = require('@nx/devkit');

const path = require('path');
const fs = require('fs');

const mainPackageJson = require('../package.json');

const { readCachedProjectGraph } = devkit;
const graph = readCachedProjectGraph();

const PREFIX = '@epam/ai-dial';

const projects = [];
for (const i in graph.nodes) {
  const rootJsonPath = graph.nodes[i]?.data?.root;
  if (rootJsonPath) {
    const p = path.resolve(__dirname, '../', rootJsonPath, 'package.json');
    if (fs.existsSync(p)) {
      const packageJson = require(p);
      projects.push(packageJson.name);
    }
  }
}

const isFromCurrentProj = (dep) => {
  if (dep.startsWith(PREFIX)) {
    // from current monorepo
    return projects.includes(dep);
  }
  return false;
};

const getDependencyVersion = (dep) => {
  let version =
    mainPackageJson.dependencies && mainPackageJson.dependencies[dep];
  if (version) {
    return version;
  }
  version =
    mainPackageJson.devDependencies && mainPackageJson.devDependencies[dep];
  if (version) {
    return version;
  }
  version =
    mainPackageJson.peerDependencies && mainPackageJson.peerDependencies[dep];
  if (version) {
    return version;
  }

  if (isFromCurrentProj(dep)) {
    version = mainPackageJson.version;
  }

  return version;
};


for (const proj in graph.nodes) {
  const packagePath = path.resolve(__dirname, '../dist/libs', proj);
  const packageJsonPath = path.resolve(packagePath, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    continue;
  }

  const packageJson = require(packageJsonPath);
  packageJson.version = mainPackageJson.version;

  for (const dep in packageJson.dependencies) {
    if (
      packageJson.dependencies[dep] === '*' ||
      packageJson.dependencies[dep] === '' ||
      isFromCurrentProj(dep)
    ) {
      packageJson.dependencies[dep] =
        getDependencyVersion(dep) || packageJson.dependencies[dep];
    }
  }
  for (const dep in packageJson.peerDependencies) {
    if (
      packageJson.peerDependencies[dep] === '*' ||
      packageJson.peerDependencies[dep] === '' ||
      isFromCurrentProj(dep)
    ) {
      packageJson.peerDependencies[dep] =
        getDependencyVersion(dep) || packageJson.peerDependencies[dep];
    }
  }

  fs.writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, void 0, 2),
    'utf-8',
  );
}
