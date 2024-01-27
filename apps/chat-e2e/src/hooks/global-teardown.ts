import { FileUtil } from '@/src/utils';

async function globalTeardown() {
  FileUtil.removeExportFolder();
}

export default globalTeardown;
