import {
	createKnipConfig,
	rootWorkspaceConfig,
	workspaceConfig,
} from "@chris-shaw-2011/lint/knip"

export default createKnipConfig({
	workspaces: {
		".": rootWorkspaceConfig({
			entry: [
				"scripts/check-apt-updates.test.ts",
				"scripts/check-docker-runtime.ts",
			],
			ignoreBinaries: ["libationcli"],
			ignoreDependencies: ["node-pty"],
		}),
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
