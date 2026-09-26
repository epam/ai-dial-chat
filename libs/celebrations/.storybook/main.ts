import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';

const getAbsolutePath = (value: string): string =>
  dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [],
  framework: {
    name: getAbsolutePath('@storybook/react-vite'),
    options: {
      builder: {
        viteConfigPath: 'vite.config.mts',
      },
    },
  },
  /* The library's own build mode and declaration emit do not belong in a
     Storybook bundle, which is an application. */
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    build: { ...viteConfig.build, lib: false },
    plugins: (viteConfig.plugins ?? [])
      .flat()
      .filter(
        (plugin) =>
          !(
            plugin &&
            typeof plugin === 'object' &&
            'name' in plugin &&
            plugin.name === 'vite:dts'
          ),
      ),
  }),
};

export default config;
