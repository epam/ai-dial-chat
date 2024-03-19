import { FileUtil } from '@/src/utils';

async function globalTeardown() {
  FileUtil.deleteExportFolder();
}

export default globalTeardown;
