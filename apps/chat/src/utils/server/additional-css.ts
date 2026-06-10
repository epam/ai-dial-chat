import fs from 'fs';
import path from 'path';

export function getAdditionalCssDir(): string {
  return (
    process.env.ADDITIONAL_CSS_DIR ?? path.join(process.cwd(), 'additional_css')
  );
}

export function getAdditionalCssFilenames(dir?: string): string[] {
  const targetDir = dir ?? getAdditionalCssDir();

  try {
    return fs
      .readdirSync(targetDir)
      .filter((file) => file.endsWith('.css'))
      .sort();
  } catch {
    return [];
  }
}

export function isValidAdditionalCssFilename(filename: string): boolean {
  if (!filename.endsWith('.css')) {
    return false;
  }

  if (
    filename.includes('..') ||
    filename.includes('/') ||
    filename.includes('\\')
  ) {
    return false;
  }

  return true;
}

export function readAdditionalCssFile(filename: string): string | null {
  if (!isValidAdditionalCssFilename(filename)) {
    return null;
  }

  const filePath = path.join(getAdditionalCssDir(), filename);

  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}
