import assert from "node:assert/strict"
import test from "node:test"
import { selectAsset } from "./resolve-libation-release.ts"

const release = {
	tag_name: "v15.0.0",
	assets: ["amd64", "arm64"].map(architecture => ({
		name: `Libation.15.0.0-linux-chardonnay-${architecture}.deb`,
		digest: `sha256:${"a".repeat(64)}`,
		browser_download_url: `https://github.com/rmcrackan/Libation/releases/download/v15.0.0/Libation.15.0.0-linux-chardonnay-${architecture}.deb`,
	})),
}

void test("selects the latest Libation package for both container architectures", () => {
	for (const architecture of ["amd64", "arm64"]) {
		assert.deepEqual(selectAsset(release, architecture), {
			version: "15.0.0",
			sha256: "a".repeat(64),
			url: `https://github.com/rmcrackan/Libation/releases/download/v15.0.0/Libation.15.0.0-linux-chardonnay-${architecture}.deb`,
		})
	}
})

void test("fails closed when the latest release lacks an expected digest or asset", () => {
	const firstAsset = release.assets[0]
	assert.ok(firstAsset)
	assert.throws(() => selectAsset({ ...release, assets: [] }, "amd64"), /verified amd64 Debian package/)
	assert.throws(() => selectAsset({ ...release, assets: [{ ...firstAsset, digest: "" }] }, "amd64"), /verified amd64 Debian package/)
	assert.throws(() => selectAsset({ ...release, tag_name: "v15-beta" }, "amd64"), /unexpected tag/)
	assert.throws(() => selectAsset(release, "armv7"), /Unsupported Libation architecture/)
})
