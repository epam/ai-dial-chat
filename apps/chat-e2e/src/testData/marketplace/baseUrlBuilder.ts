import config from '@/config/chat.playwright.config';

export abstract class BaseUrlBuilder {
  protected readonly baseUrl: string;
  protected queryParams = new Map<string, string | string[] | number>();

  protected constructor(basePath = '', includeBaseURL = true) {
    this.baseUrl = includeBaseURL ? config.use!.baseURL! + basePath : basePath;
  }

  protected addParam(
    key: string,
    value: string | string[] | number | null | undefined,
  ): this {
    if (!value) return this;

    if (Array.isArray(value) && value.length > 0) {
      this.queryParams.set(key, value);
    } else if (
      (typeof value === 'string' && value.trim()) ||
      typeof value === 'number'
    ) {
      this.queryParams.set(key, value);
    }
    return this;
  }

  protected addArrayParam(key: string, values: string[]): this {
    if (values.length > 0) {
      this.queryParams.set(key, values);
    }
    return this;
  }

  protected buildQueryString(): string {
    const params: string[] = [];
    for (const [key, value] of this.queryParams) {
      if (Array.isArray(value)) {
        params.push(`${key}=${value.join(',')}`);
      } else {
        params.push(`${key}=${value}`);
      }
    }
    return params.length > 0 ? `?${params.join('&')}` : '';
  }

  protected resetParams(): void {
    this.queryParams.clear();
  }

  abstract build(): string;
}
