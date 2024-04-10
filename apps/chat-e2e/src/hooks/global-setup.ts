import { ResultFolder } from '@/src/testData';
import { FileUtil } from '@/src/utils';
import path from 'path';

export const isApiStorageType =
  process.env.STORAGE_TYPE === 'api' || process.env.STORAGE_TYPE === undefined;

export const ExecutionResults = {
  allureReportPath: path.resolve(
    __dirname,
    `../../${ResultFolder.allureChatReport}`,
  ),
  allureOverlayReportPath: path.resolve(
    __dirname,
    `../../${ResultFolder.allureOverlayReport}`,
  ),
  htmlReportPath: path.resolve(__dirname, `../../${ResultFolder.htmlReport}`),
  testResultsPath: path.resolve(__dirname, `../../${ResultFolder.testResults}`),
};

async function globalSetup() {
  for (const path of Object.values(ExecutionResults)) {
    FileUtil.deleteFolder(path);
  }
}

export default globalSetup;
