import typia from "typia"

interface LibationAsset {
	name: string,
	digest: string,
	browser_download_url: string,
}

export interface LibationRelease {
	tag_name: string,
	assets?: LibationAsset[],
}

export const LibationRelease = { fromUnknown: typia.createAssert<LibationRelease>() }
