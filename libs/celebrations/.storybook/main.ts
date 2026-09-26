import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';

const getAbsolutePath = (value: string): string =>
  dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));

/* The library build appends Tailwind utilities to dist/index.css and emits
   declarations; Storybook compiles its own utilities through preview.css. */
const LIBRARY_ONLY_PLUGINS = new Set(['vite:dts', 'lib-tailwind-utilities']);

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
            LIBRARY_ONLY_PLUGINS.has(plugin.name)
          ),
      ),
  }),
};

export default config;
