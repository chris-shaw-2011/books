import fs from "fs/promises"
import path from "path"

const filePath = path.resolve("./package.json")
const fileContent = await fs.readFile(filePath, "utf-8")
const packageJson = JSON.parse(fileContent) as Record<string, unknown>

packageJson.main = "./src/index.js"

await fs.writeFile("../../bin/projects/shared/package.json", `${JSON.stringify(packageJson, null, 2)}\n`, "utf-8")