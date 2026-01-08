export class UserUtil {
  public static getE2EUser(parallelIndex: number) {
    return process.env.E2E_USERNAME!.split(',')[parallelIndex];
  }

  public static getE2EUsername(parallelIndex: number) {
    const user = UserUtil.getE2EUser(parallelIndex);
    return user.substring(0, user.indexOf('@'));
  }
}
