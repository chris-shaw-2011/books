import baseConfig from "../../eslint.config.ts"
import reactHooks from "eslint-plugin-react-hooks"
import reactPlugin from "eslint-plugin-react"
import reactRefresh from "eslint-plugin-react-refresh"
import globals from "globals"

export default [
	...baseConfig,
	reactHooks.configs.flat["recommended-latest"],
	reactRefresh.configs.recommended,
	{
		files: ["src/**/*.{js,mjs,cjs,jsx,mjsx,ts,tsx,mtsx}"],
		...reactPlugin.configs.flat.recommended,
		...reactPlugin.configs.flat["jsx-runtime"],
		languageOptions: {
			...reactPlugin.configs.flat.recommended.languageOptions,
			globals: {
				...globals.serviceworker,
				...globals.browser,
			},
		},
		rules: {
			"@stylistic/jsx-max-props-per-line": [
				"error", {
					maximum: 1,
					when: "multiline",
				},
			],
			"@stylistic/jsx-one-expression-per-line": [
				"error", {
					allow: "single-line",
				},
			],
		},
	},
]