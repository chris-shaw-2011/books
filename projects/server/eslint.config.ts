import config from "@chris-shaw-2011/lint"
import { sharedValidationRules } from "../../eslint.config.ts"

export default [
	...config,
	{ rules: sharedValidationRules },
]
