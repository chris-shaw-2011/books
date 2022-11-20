import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

const proxyOptions = {
	target: "http://localhost:3001",
	changeOrigin: true,
	secure: false,
}

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	build: {
		outDir: "../../bin/client",
		emptyOutDir: true,
	},
	optimizeDeps: {
		include: ["@books/shared"]
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
		}
	}
})