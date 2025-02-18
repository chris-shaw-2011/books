import baseConfig from "../../eslint.config.ts"

export default [
	...baseConfig,
	{
		files: ["src/**/*.ts"], // Adjust as needed
		languageOptions: {
			parserOptions: {
				projectService: true,
			},
		},
		rules: {
			// Server-specific rules here
		},
	},
]