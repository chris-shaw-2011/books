export const AllowedUploadFileExtensions = [
	".aax",
	".zip",
	".mp3",
]

export const canBeUploaded = (fileName: string) => {
	const fileNameLower = fileName.toLowerCase()

	for (const ext of AllowedUploadFileExtensions) {
		if (fileNameLower.endsWith(ext)) {
			return true
		}
	}

	return false
}