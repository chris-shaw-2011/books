import baseConfig from '../../eslint.config.js';
import reactHooks from "eslint-plugin-react-hooks"

export default [
	...baseConfig,
	//reactHooks.configs.recommended, //uncomment when this is done https://github.com/facebook/react/issues/28313
	{
		files: ['src/**/*.ts'], // Adjust as needed
		languageOptions: {
			parserOptions: {
				project: ["tsconfig.json", "../shared/tsconfig.json"],
			},
		},
		rules: {
			// Server-specific rules here
		},
	},
];