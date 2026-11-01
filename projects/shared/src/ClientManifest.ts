import typia from "typia"

interface ClientManifestEntry {
	file: string,
	imports?: string[],
	css?: string[],
}

export const ClientManifest = { fromUnknown: typia.createAssert<Record<string, ClientManifestEntry>>() }
