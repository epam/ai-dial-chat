import baseConfig from '../../eslint.config.mjs';

export default [
	...baseConfig,
	{
		ignores: ['.next/**/*'],
	},
	{
		files: ['apps/overlay-sandbox/**/*.{ts,tsx,js,jsx}'],
		rules: {
			'@next/next/no-html-link-for-pages': [
				'error',
				'apps/overlay-sandbox/pages',
			],
		},
	},
];
