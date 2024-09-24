const fs = require('fs');
const path = require('path');
const glob = require('glob');

const pagesDir = path.join(__dirname, '../src/lib/pages');
const routesOutputFilePath = path.join(__dirname, '../src/lib/routes.ts');
const matchersOutputFilePath = path.join(__dirname, '../src/lib/matchers.ts');

function getMatcher(filePath) {
  const relativePath = path.relative(pagesDir, filePath);
  const withoutExtension = relativePath.replace(/\.[^/.]+$/, '');
  const parts = withoutExtension.split(path.sep);

  if (parts[parts.length - 1] === 'index') {
    parts.pop();
  }

  return (
    '/' +
    parts
      .map((part) => {
        if (part.startsWith('[') && part.endsWith(']')) {
          const param = part.slice(1, -1);
          if (param.startsWith('...')) {
            return `:${param.slice(3)}*`;
          }
          return `:${param}`;
        }
        return part;
      })
      .join('/')
  );
}

function compareRoutes(a, b) {
  const aParts = a.split('/');
  const bParts = b.split('/');

  const aStaticParts = aParts.filter(
    (part) => !part.startsWith(':') && !part.includes('*'),
  );
  const bStaticParts = bParts.filter(
    (part) => !part.startsWith(':') && !part.includes('*'),
  );
  if (aStaticParts.length !== bStaticParts.length) {
    return bStaticParts.length - aStaticParts.length;
  }

  for (let i = 0; i < aParts.length; i++) {
    const aPart = aParts[i];
    const bPart = bParts[i];

    if (aPart.startsWith(':') && !bPart.startsWith(':')) {
      return 1;
    }
    if (!aPart.startsWith(':') && bPart.startsWith(':')) {
      return -1;
    }

    if (aPart.startsWith(':') && bPart.startsWith(':')) {
      const aParams = aPart.match(/:/g).length;
      const bParams = bPart.match(/:/g).length;
      if (aParams !== bParams) {
        return bParams - aParams;
      }
    }

    if (aPart.includes('*') && !bPart.includes('*')) {
      return 1;
    }
    if (!aPart.includes('*') && bPart.includes('*')) {
      return -1;
    }
  }

  return 0;
}

function generateRoutes() {
  console.log('Generating routes...');

  const files = glob.sync('**/*.{js,jsx,ts,tsx}', { cwd: pagesDir });

  const routes = files.map((file) => {
    const filePath = path.join(pagesDir, file);
    const relativeFilePath = path.relative(
      path.dirname(routesOutputFilePath),
      filePath,
    );
    const withoutExtension = relativeFilePath.replace(/\.[^/.]+$/, '');
    const matcher = getMatcher(filePath);
    return { matcher, path: `./${withoutExtension.replace(/\\/g, '/')}` };
  });

  // Сортируем маршруты
  routes.sort((a, b) => compareRoutes(a.matcher, b.matcher));

  let routesContent = 'export const lazyRoutes = {\n';

  routes.forEach(({ matcher, path }) => {
    routesContent += `    "${matcher}": import('${path}'),\n`;
  });

  routesContent += '};\n';

  fs.writeFileSync(routesOutputFilePath, routesContent, 'utf-8');

  console.log('Routes generated successfully!');
  // ---
  console.log('Generating matchers...');

  let matchersContent = 'export const matchers = [\n';

  routes.forEach(({ matcher }) => {
    matchersContent += ` { source: "${matcher}" },\n`;
  });

  matchersContent += '];\n';

  fs.writeFileSync(matchersOutputFilePath, matchersContent, 'utf-8');
  console.log('Matchers generated successfully!');

  process.exit(0);
}

generateRoutes();
