import typia from "typia"

interface LockedPackage {
	dev?: boolean,
	link?: boolean,
	version?: string,
	resolved?: string,
	integrity?: string,
}
export interface Lockfile { packages: Record<string, LockedPackage> }

export const PackageManifest = { fromUnknown: typia.createAssert<{ version: string }>() }
export const Lockfile = { fromUnknown: typia.createAssert<Lockfile>() }
export const VersionedLockfile = { fromUnknown: typia.createAssert<Lockfile & { version: string, packages: { "": { version: string } } }>() }
