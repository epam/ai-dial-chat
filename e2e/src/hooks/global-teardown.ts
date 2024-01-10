import { FileUtil } from '@/e2e/src/utils';

async function globalTeardown() {
  FileUtil.removeExportFolder();
}

export default globalTeardown;
