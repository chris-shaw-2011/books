import baseConfig from '../../eslint.config.js';

export default [
	...baseConfig,
	{
		files: ['src/**/*.ts'], // Adjust as needed
		languageOptions: {
			parserOptions: {
				project: './tsconfig.json',
			},
		},
		ignores: [
			"rollup.config.js",
		],
		rules: {
			// Server-specific rules here
		},
	},
];