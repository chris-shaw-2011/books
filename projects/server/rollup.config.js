import typescript from "@rollup/plugin-typescript";
import alias from "@rollup/plugin-alias";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
	input: "src/index.ts",
	output: {
		dir: "../../bin/server",
		format: "es",
		sourcemap: true,
	},
	plugins: [
		typescript({
			tsconfig: "./tsconfig.server.json",
			sourceRoot: ".",
		}),
		alias({
			entries: [
				{ find: "@books/shared", replacement: path.resolve(__dirname, "../../bin/shared/index.js") }
			]
		}),
	],
}