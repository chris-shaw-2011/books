import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

const debug = false
const proxyOptions = {
	target: "http://localhost:3001",
	changeOrigin: true,
	secure: false,
}

const AdminOnly = ["EditSettings", "AdminApi", "AdminNavOptions", "Settings", "UserList"]
const AuthenticatedOnly = ["Authenticated", "Navigation"]
const PublicOnly = ["SetPassword"]

const debugLog = (message: string, ...optionalParams: unknown[]) => {
	if (debug) {
		// eslint-disable-next-line no-console
		console.log(message, optionalParams)
	}
}

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
	plugins: [react()],
	css: {
		modules: {
			...(command === "build" && { generateScopedName: "_[hash:base64:5]" }),
		},
	},
	build: {
		outDir: "../../bin/projects/client",
		emptyOutDir: true,
		manifest: true,
		target: "esnext",
		rollupOptions: {
			output: {
				manualChunks: id => {
					if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
						return "react"
					}
				},
				chunkFileNames: chunkInfo => {
					const file = chunkInfo.name

					if (AdminOnly.some(n => file === n)) {
						debugLog(`${file} is an admin file`, chunkInfo)

						return "assets/admin/[name]-[hash].js"
					}
					else if (AuthenticatedOnly.some(n => file === n)) {
						debugLog(`${file} is an authenticated file`, chunkInfo)

						return "assets/authenticated/[name]-[hash].js"
					}
					else if (PublicOnly.some(n => file === n)) {
						debugLog(`${file} is a public file`, chunkInfo)

						return "assets/public/[name]-[hash].js"
					}

					debugLog(`${file} is a public file`, chunkInfo)

					return "assets/[name]-[hash].js"
				},
				assetFileNames: assetInfo => {
					const name = assetInfo.names[0] ?? ""

					if (AdminOnly.some(n => name.startsWith(n))) {
						debugLog(`${name} is an admin asset`, assetInfo)

						return "assets/admin/[name]-[hash][extname]"
					}
					else if (AuthenticatedOnly.some(n => name.startsWith(n))) {
						debugLog(`${name} is an authenticated asset`, assetInfo)

						return "assets/authenticated/[name]-[hash][extname]"
					}
					else if (PublicOnly.some(n => name.startsWith(n))) {
						debugLog(`${name} is a public asset`, assetInfo)

						return "assets/public/[name]-[hash][extname]"
					}

					debugLog(`${name} is a public asset`, assetInfo)

					return "assets/[name]-[hash][extname]"
				},
			},
		},
		modulePreload: {
			polyfill: false,
		},
	},
	server: {
		open: "/",
		port: 3000,
		proxy: {
			"/files": proxyOptions,
			"/books": proxyOptions,
			"/auth": proxyOptions,
			"/changeBookStatus": proxyOptions,
			"/updateSettings": proxyOptions,
			"/users": proxyOptions,
			"/addUser": proxyOptions,
			"/deleteUser": proxyOptions,
			"/user": proxyOptions,
			"/changePassword": proxyOptions,
			"/upload": proxyOptions,
			"/conversionUpdate": proxyOptions,
			"/addFolder": proxyOptions,
			"/updateBook": proxyOptions,
			"/settings": proxyOptions,
			"/setPassword": proxyOptions,
		},
	},
}))
