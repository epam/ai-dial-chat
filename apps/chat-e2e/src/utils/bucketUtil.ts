export class BucketUtil {
  public static getBucket() {
    const bucketObject = JSON.parse(process.env.BUCKET!) as { bucket: string };
    return bucketObject.bucket;
  }
}
