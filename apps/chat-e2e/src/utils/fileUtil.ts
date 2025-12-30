import { Import } from '@/src/testData';
import { GeneratorUtil } from '@/src/utils/generatorUtil';
import AdmZip from 'adm-zip';
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

  public static readPlainFileData(path: string): Buffer {
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

  public static getBase64FileContent(path: string) {
    const buffer = FileUtil.readPlainFileData(path);
    return buffer.toString('base64');
  }

  public static readArchive(archivePath: string) {
    return new AdmZip(archivePath);
  }

  public static getArchiveEntry(archive: AdmZip, entryPath: string) {
    const archiveEntry = archive.getEntry(entryPath);
    if (!archiveEntry) {
      throw new Error(
        `The file: "${entryPath}" does not exist in the archive.`,
      );
    }
    return archiveEntry;
  }

  public static getArchiveEntries(archive: AdmZip) {
    return archive.getEntries();
  }

  public static parseArchiveEntryJson<T>(archiveEntry: AdmZip.IZipEntry): T {
    let jsonData: T;
    try {
      const jsonContent = archiveEntry.getData().toString('utf8');
      jsonData = JSON.parse(jsonContent) as T;
    } catch (error) {
      throw new Error(
        `Failed to parse JSON content from "${archiveEntry.entryName}": ${(error as Error).message}`,
      );
    }
    return jsonData;
  }

  public static getFilenameWithoutExtension(filename: string) {
    const separator = '.';
    return filename.includes(separator)
      ? filename.substring(0, filename.lastIndexOf(separator))
      : filename;
  }
}
