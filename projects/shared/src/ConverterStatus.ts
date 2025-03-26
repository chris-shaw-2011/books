const converterStatuses = ["Waiting", "Unzipping", "Cracking", "Converting", "Error", "Complete"] as const

export default converterStatuses
export type ConverterStatus = typeof converterStatuses[number]