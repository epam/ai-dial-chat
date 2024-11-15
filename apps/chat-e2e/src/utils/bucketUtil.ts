import config from '@/config/chat.playwright.config';

export class BucketUtil {
  public static getBucket(index?: number) {
    const bucketKey = index ?? process.env.TEST_PARALLEL_INDEX;
    const bucketObject = JSON.parse(process.env['BUCKET' + bucketKey]!) as {
      bucket: string;
    };
    return bucketObject.bucket;
  }

  public static getAdditionalShareUserBucket() {
    return BucketUtil.getBucket(+config.workers!);
  }

  public static getAdditionalSecondShareUserBucket() {
    return BucketUtil.getBucket(+config.workers! + 1);
  }

  public static getAdminUserBucket() {
    return BucketUtil.getBucket(+config.workers! + 2);
  }
}
