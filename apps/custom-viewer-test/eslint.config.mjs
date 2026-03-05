import baseConfig from '../../eslint.config.mjs';

export default [
	...baseConfig,
	{
		ignores: ['.next/**/*'],
	},
	{
		files: ['apps/custom-viewer-test/**/*.{ts,tsx,js,jsx}'],
		rules: {
			'@next/next/no-html-link-for-pages': [
				'error',
				'apps/custom-viewer-test/pages',
			],
		},
	},
];
