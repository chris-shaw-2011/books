import baseConfig from "../../eslint.config.ts"

export default [
	...baseConfig,
	{
		files: ["src/**/*.ts"],
		languageOptions: {
			parserOptions: {
				project: ["tsconfig.json", "../shared/tsconfig.json"],
				projectService: true,
			},
		},
		rules: {
			// Server-specific rules here
		},
	},
]