export class BucketUtil {
  public static getBucket() {
    const bucketObject = JSON.parse(
      process.env['BUCKET' + process.env.TEST_PARALLEL_INDEX]!,
    ) as {
      bucket: string;
    };
    return bucketObject.bucket;
  }
}
