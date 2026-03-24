import {
	createKnipConfig,
	rootWorkspaceConfig,
	workspaceConfig,
} from "@chris-shaw-2011/lint/knip"

export default createKnipConfig({
	workspaces: {
		".": rootWorkspaceConfig(),
		"projects/*": workspaceConfig(),
		"projects/client": workspaceConfig({
			entry: [
				"src/app/AdminNavOptions.tsx",
				"src/app/api/AdminApi.ts",
				"src/app/Authenticated.tsx",
				"src/app/EditSettings.tsx",
				"src/app/Navigation.tsx",
				"src/app/UserList.tsx",
			],
		}),
	},
})
