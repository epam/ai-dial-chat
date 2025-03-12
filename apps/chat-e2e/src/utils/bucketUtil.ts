import config, { overlayHost } from '@/config/chat.playwright.config';

export class BucketUtil {
  public static getBucket(index?: number) {
    const bucketKey = index ?? process.env.TEST_PARALLEL_INDEX;
    const bucketObject = JSON.parse(process.env['BUCKET' + bucketKey]!) as {
      bucket: string;
    };
    return bucketObject.bucket;
  }

  public static getAdditionalShareUserBucket() {
    return BucketUtil.getBucket(
      +process.env.TEST_PARALLEL_INDEX! + +config.workers!,
    );
  }

  public static getAdditionalSecondShareUserBucket() {
    return BucketUtil.getBucket(
      +process.env.TEST_PARALLEL_INDEX! + +config.workers! * 2,
    );
  }

  public static getAdminUserBucket() {
    const baseUrl = config.use!.baseURL;
    const index =
      baseUrl === overlayHost ? +config.workers! : +config.workers! * 3;
    return BucketUtil.getBucket(index);
  }
}
