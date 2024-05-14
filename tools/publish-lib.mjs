/**
 * This is a minimal script to publish your package to "npm".
 * This is meant to be used as-is or customize as you see fit.
 *
 * This script is executed on "dist/path/to/library" as "cwd" by default.
 *
 * You might need to authenticate with NPM before running this script.
 */
import mainPackageJson from '../package.json' with { type: "json" };

import devkit from '@nx/devkit';
import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import minimist from 'minimist';
import path from 'path';
import { fileURLToPath } from 'url';
const PREFIX = '@epam/ai-dial';

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const { readCachedProjectGraph } = devkit;

function invariant(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

// Executing publish script: node path/to/publish.mjs {name} --version {version} --tag {tag}
// Default "tag" to "next" so we won't publish the "latest" tag by accident.
let params = minimist(process.argv);
let version = params.version;
const isDevelopment = params.development;
const dry = params.dry === 'true';
const tag = params.tag || 'next';
const name = params['_'][2];

console.info(
  `\nPublish run with next values:\nname=${name}\nversion=${version}\ndry=${dry}\ntag=${tag}\ndevelopment=${isDevelopment}\n`,
);

const getVersion = (version) => {
  let potentialVersion = version;

  if (isDevelopment && !version) {
    potentialVersion = getDevVersion(potentialVersion);
    invariant(potentialVersion !== 'dev', `Version calculated incorrectly - still equal 'dev'.`)
  }

  return potentialVersion || mainPackageJson.version;
}
version = getVersion(version);

// A simple SemVer validation to validate the version
const validVersion = /^\d+\.\d+\.\d+(-\w+\.\d+)?/;
invariant(
  version && (validVersion.test(version) || version === 'dev'),
  `No version provided or version did not match Semantic Versioning, expected: #.#.#-tag.# or #.#.# or special name 'dev', got ${version}.`,
);

const graph = readCachedProjectGraph();
const project = graph.nodes[name];

invariant(
  project,
  `Could not find project "${name}" in the workspace. Is the project.json configured correctly?`,
);

const projects = [];
for (const i in graph.nodes) {
  const rootJsonPath = graph.nodes[i]?.data?.root;

  if (rootJsonPath) {
    const p = path.resolve(__dirname, '../', rootJsonPath, 'package.json');
    if (existsSync(p)) {
      const packageJson = JSON.parse(readFileSync(p).toString());

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
  let localVersion =
    mainPackageJson.dependencies && mainPackageJson.dependencies[dep];
  if (localVersion) {
    return localVersion;
  }
  localVersion =
    mainPackageJson.devDependencies && mainPackageJson.devDependencies[dep];
  if (localVersion) {
    return localVersion;
  }
  localVersion =
    mainPackageJson.peerDependencies && mainPackageJson.peerDependencies[dep];
  if (localVersion) {
    return localVersion;
  }

  if (isFromCurrentProj(dep)) {
    localVersion = version;
  }

  return localVersion;
};

const outputPath = project.data?.targets?.build?.options?.outputPath;
invariant(
  outputPath,
  `Could not find "build.options.outputPath" of project "${name}". Is project.json configured  correctly?`,
);

process.chdir(outputPath);

// Updating the version in "package.json" before publishing
try {
  const json = JSON.parse(readFileSync(`package.json`).toString());
  json.version = version;

  for (const dep in json.dependencies) {
    if (
      json.dependencies[dep] === '*' ||
      json.dependencies[dep] === '' ||
      isFromCurrentProj(dep)
    ) {
      json.dependencies[dep] =
        getDependencyVersion(dep) || json.dependencies[dep];
    }
  }
  for (const dep in json.peerDependencies) {
    if (
      json.peerDependencies[dep] === '*' ||
      json.peerDependencies[dep] === '' ||
      isFromCurrentProj(dep)
    ) {
      json.peerDependencies[dep] =
        getDependencyVersion(dep) || json.peerDependencies[dep];
    }
  }

  writeFileSync(`package.json`, JSON.stringify(json, null, 2));
} catch (e) {
  console.error(`Error reading package.json file from library build output.`);
}

// Execute "npm publish" to publish
execSync(`npm publish --access public --tag ${tag} --dry-run ${dry}`);

function getDevVersion(potentialVersion) {
  try{
    const result = JSON.parse(execSync(`npm view ${PREFIX}-${name} versions --json`).toString());
    const lastVersionToIncrement = result
      .filter(ver => ver.startsWith(mainPackageJson.version))
      .map(ver => ver.match(/\d+$/)?.[0])
      .filter(Boolean)
      .map(ver => parseInt(ver, 10))
      .sort((a, b) => a - b)
      .reverse()[0];

    if (typeof lastVersionToIncrement !== 'undefined') {
      const incrementedNum = lastVersionToIncrement + 1;
      potentialVersion = `${mainPackageJson.version}.${incrementedNum}`;
    } else {
      potentialVersion = `${mainPackageJson.version}.0`;
    }
    console.log(`Version of development package for ${PREFIX + '-' + name} will be: ${potentialVersion}`);
    return potentialVersion;
    
  }catch(e){
    if(JSON.parse(e.stdout).error.code === 'E404'){
      console.error(`Could not get versions from registry. Version from package.json will be used.\n `);
      
      potentialVersion = `${mainPackageJson.version}.0`;
      
      console.log(`Version of development package for ${PREFIX + '-' + name} will be: ${potentialVersion}`);
      return potentialVersion;
    }

    console.error(`Could not get versions from registry.`);
    
  }
  
}
