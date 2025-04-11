// @ts-check

import eslint from "@eslint/js"
import tseslint from "typescript-eslint"
import stylistic from "@stylistic/eslint-plugin"

export default tseslint.config(
	eslint.configs.recommended,
	...tseslint.configs.strictTypeChecked,
	...tseslint.configs.stylisticTypeChecked,
	stylistic.configs.customize({
		indent: "tab",
		quotes: "double",
		semi: false,
		jsx: true,
	}),
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
				ecmaVersion: "latest",
				sourceType: "module",
			},
		},
		linterOptions: {
			reportUnusedDisableDirectives: "error",
		},
		rules: {
			"arrow-body-style": ["error", "as-needed"],
			"@typescript-eslint/explicit-module-boundary-types": "off",
			"@stylistic/arrow-parens": [
				"error",
				"as-needed",
			],
			"semi": [
				"error",
				"never",
			],
			"quotes": [
				"error",
				"double", {
					allowTemplateLiterals: true,
				},
			],
			"@typescript-eslint/no-floating-promises": "error",
			"no-console": "error",
			"@typescript-eslint/no-deprecated": "warn",
			"no-use-before-define": "off",
			"@typescript-eslint/no-use-before-define": [
				"error",
			],
			"prefer-template": "error",
			"@typescript-eslint/restrict-template-expressions": [
				"error", {
					allowNullish: true,
				},
			],
			"@stylistic/comma-dangle": ["error", "always-multiline"],
			"@stylistic/member-delimiter-style": [
				"error", {
					multiline: {
						delimiter: "comma",
						requireLast: true,
					},
					singleline: {
						delimiter: "comma",
						requireLast: false,
					},
				},
			],
			"@stylistic/eol-last": ["error", "never"],
			"@stylistic/operator-linebreak": ["error", "after"],
			"@typescript-eslint/no-confusing-void-expression": [
				"error",
				{
					ignoreArrowShorthand: true,
				},
			],
		},
	},
	{
		ignores: [
			"node_modules/*",
			"bin/*",
			".vscode/*",
			"projects/shared/fixPackageMain.js",
		],
	},
)