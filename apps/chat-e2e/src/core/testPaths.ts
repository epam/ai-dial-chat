import * as fs from 'fs';
import path from 'path';

export const modelsFilePath = path.join(__dirname, '../../auth/models.json');

export function writeModelsFile(content: string) {
  fs.mkdirSync(path.dirname(modelsFilePath), { recursive: true });
  fs.writeFileSync(modelsFilePath, content, 'utf-8');
}
