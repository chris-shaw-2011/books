const converterStatuses = ["Waiting", "Extracting", "Cracking", "Converting", "Combining", "Error", "Complete"] as const

export default converterStatuses
export type ConverterStatus = typeof converterStatuses[number]
