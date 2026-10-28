const seriesOrderSchema = { type: "number", minimum: 0 } as const

export const audibleSelectionSchema = {
	body: {
		type: "object",
		required: ["sessionId", "asins"],
		properties: {
			sessionId: { type: "string", minLength: 1 },
			asins: { type: "array", minItems: 1, uniqueItems: true, items: { type: "string", minLength: 1 } },
			organizations: {
				type: "object",
				additionalProperties: {
					type: "object",
					required: ["folderPath", "series", "padding"],
					properties: {
						folderPath: { type: "string", pattern: "^/" },
						padding: { type: "integer", minimum: 1, maximum: 6 },
						series: {
							type: "object",
							required: ["name", "order"],
							properties: { name: { type: "string", pattern: "\\S" }, order: seriesOrderSchema },
						},
					},
				},
			},
		},
	},
} as const

export const updateBookSchema = {
	body: {
		type: "object",
		required: ["newBook"],
		properties: {
			newBook: {
				type: "object",
				required: ["id", "name", "folderPath"],
				properties: {
					id: { type: "string", minLength: 1 },
					name: { type: "string", minLength: 1 },
					folderPath: { type: "string", minLength: 1 },
					author: { type: "string" },
					year: { type: "integer", minimum: 0 },
					comment: { type: "string" },
					narrator: { type: "string" },
					genre: { type: "string" },
					series: { type: "string" },
					seriesOrder: seriesOrderSchema,
				},
			},
		},
	},
} as const
