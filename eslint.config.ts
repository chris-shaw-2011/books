import config from "@chris-shaw-2011/lint"

export const sharedValidationRules = {
	"no-restricted-imports": ["error", {
		patterns: [{ group: ["typia", "typia/*"], message: "Use a shared model's fromUnknown factory; Typia belongs in projects/shared." }],
	}] as const,
}

export default [
	...config,
	{
		files: ["projects/client/**/*.{ts,tsx}", "projects/server/**/*.ts", "scripts/**/*.ts"],
		rules: sharedValidationRules,
	},
]
