export class DateUtil {
  static oneDayInMs = 24 * 60 * 60 * 1000;
  static today = new Date().getTime();
  public static getYesterdayDate() {
    return DateUtil.today - DateUtil.oneDayInMs;
  }

  public static getLastWeekDate() {
    return DateUtil.today - DateUtil.oneDayInMs * 3;
  }

  public static getLastMonthDate() {
    return DateUtil.today - DateUtil.oneDayInMs * 10;
  }

  public static getOlderDate() {
    return DateUtil.today - DateUtil.oneDayInMs * 40;
  }

  public static convertUnixTimestampToLocalDate(timestamp: number) {
    return new Date(timestamp).toLocaleString();
  }
}
