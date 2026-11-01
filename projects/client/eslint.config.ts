import config from "@chris-shaw-2011/lint/react"
import { sharedValidationRules } from "../../eslint.config.ts"

export default [
	{
		ignores: [".generated/**"],
	},
	...config,
	{ rules: sharedValidationRules },
]
