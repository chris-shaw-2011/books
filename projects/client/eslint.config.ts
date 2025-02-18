import baseConfig from "../../eslint.config.ts"
import reactHooks from "eslint-plugin-react-hooks"
// import reactCompiler from "eslint-plugin-react-compiler"
import reactPlugin from "eslint-plugin-react"
import reactRefresh from "eslint-plugin-react-refresh"
import globals from "globals"

export default [
	...baseConfig,
	reactRefresh.configs.recommended,
	{
		files: ["src/**/*.{js,mjs,cjs,jsx,mjsx,ts,tsx,mtsx}"],
		...reactPlugin.configs.flat.recommended,
		...reactPlugin.configs.flat["jsx-runtime"],
		languageOptions: {
			...reactPlugin.configs.flat.recommended.languageOptions,
			parserOptions: {
				project: ["tsconfig.json", "../shared/tsconfig.json"],
			},
			globals: {
				...globals.serviceworker,
				...globals.browser,
			},
		},
		plugins: { "react-hooks": reactHooks },
		rules: {
			"react-hooks/rules-of-hooks": "error",
			"react-hooks/exhaustive-deps": "warn",
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
	// TODO: uncomment when this is fixed: https://github.com/eslint/eslint/issues/19413
	// reactCompiler.configs.recommended,
]