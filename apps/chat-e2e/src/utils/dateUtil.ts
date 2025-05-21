export class DateUtil {
  static oneDayInMs = 24 * 60 * 60 * 1000;

  public static getTodayDate() {
    return new Date().getTime();
  }

  public static getYesterdayDate() {
    return DateUtil.getTodayDate() - DateUtil.oneDayInMs;
  }

  public static getLastSevenDaysDate() {
    return DateUtil.getTodayDate() - DateUtil.oneDayInMs * 3;
  }

  public static getLastThirtyDaysDate() {
    return DateUtil.getTodayDate() - DateUtil.oneDayInMs * 10;
  }

  public static getOlderDate() {
    return DateUtil.getTodayDate() - DateUtil.oneDayInMs * 40;
  }

  public static convertUnixTimestampToLocalDate(timestamp: number) {
    return new Date(timestamp).toLocaleDateString();
  }

  public static getCurrentLocalDate() {
    return new Date().toLocaleDateString();
  }
}
