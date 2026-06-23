import { Injectable } from '@nestjs/common';
import type { ConfigProvider } from '../app-config.types';
import { CONFIG_DEFINITIONS } from './config-registry.constants';

@Injectable()
export class StaticDefaultsProvider implements ConfigProvider {
  async resolve(key: string): Promise<unknown | undefined> {
    const definition = CONFIG_DEFINITIONS.find((d) => d.key === key);
    if (!definition) {
      return undefined;
    }
    return definition.defaultValue;
  }
}
