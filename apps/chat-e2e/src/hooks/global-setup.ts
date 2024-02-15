import { ResultFolder } from '@/src/testData';
import { FileUtil } from '@/src/utils';
import path from 'path';

export const isApiStorageType =
  process.env.STORAGE_TYPE === 'api' || process.env.STORAGE_TYPE === undefined;

export const ExecutionResults = {
  allureReportPath: path.resolve(
    __dirname,
    `../../${ResultFolder.allureReport}`,
  ),
  htmlReportPath: path.resolve(__dirname, `../../${ResultFolder.htmlReport}`),
  testResultsPath: path.resolve(__dirname, `../../${ResultFolder.testResults}`),
};

async function globalSetup() {
  for (const path of Object.values(ExecutionResults)) {
    FileUtil.removeFolder(path);
  }
}

export default globalSetup;
