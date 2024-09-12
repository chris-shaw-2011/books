import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	eslint.configs.recommended,
	...tseslint.configs.strictTypeChecked,
	...tseslint.configs.stylisticTypeChecked,
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
				ecmaVersion: "latest",
				sourceType: "module",
				project: [
					"tsconfig.json"
				]
			},
		},
	},
	{
		ignores: [
			"node_modules/*",
			"dist/*",
			".vscode/*",
			"eslint.config.js",
			"rollup.config.js",
		]
	},
	{
		rules: {
			"@typescript-eslint/explicit-module-boundary-types": "off",
			"arrow-parens": [
				"error",
				"as-needed"
			],
			"semi": [
				"error",
				"never"
			],
			"quotes": [
				"error",
				"double",
				{
					"allowTemplateLiterals": true
				}
			],
			"@typescript-eslint/no-floating-promises": "error",
			"no-console": "error",
			"@typescript-eslint/no-deprecated": "warn",
			"no-use-before-define": "off",
			"@typescript-eslint/no-use-before-define": [
				"error"
			],
			"prefer-template": "error",
			"@typescript-eslint/restrict-template-expressions": [
				"error",
				{
					allowNullish: true,
				}
			]
		}
	})