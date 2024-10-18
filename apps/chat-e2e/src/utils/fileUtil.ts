import { Import } from '@/src/testData';
import { GeneratorUtil } from '@/src/utils/generatorUtil';
import * as fs from 'fs';
import { PathLike } from 'fs';
import path from 'path';

export class FileUtil {
  public static writeDataToFile(data: unknown) {
    const stringData = JSON.stringify(data);
    const filename = `${GeneratorUtil.randomString(10)}.json`;
    fs.writeFileSync(
      path.join(Import.importPath, filename),
      stringData,
      'utf-8',
    );
    return filename;
  }

  public static readJsonFileData(path: string) {
    const content = fs.readFileSync(path, 'utf-8');
    return content.length > 0 ? JSON.parse(content) : undefined;
  }

  public static readFileData(path: string): Buffer | undefined {
    return fs.readFileSync(path);
  }

  public static deleteExportFolder() {
    FileUtil.deleteFolder(Import.exportPath);
  }

  public static deleteFolder(path: PathLike) {
    fs.rmSync(path, {
      recursive: true,
      force: true,
    });
  }

  public static deleteImportFile(filename: string) {
    if (filename !== undefined) {
      fs.unlinkSync(path.join(Import.importPath, filename));
    }
  }

  public static getExportedFiles() {
    if (fs.existsSync(Import.exportPath)) {
      return fs
        .readdirSync(Import.exportPath)
        .map((file) => path.join(Import.exportPath, file))
        .filter((file) => fs.statSync(file).isFile());
    }
  }
}
