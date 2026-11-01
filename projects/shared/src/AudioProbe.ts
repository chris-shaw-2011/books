import typia from "typia"

export const AudioProbe = {
	fromUnknown: typia.createAssert<{
		format?: {
			duration?: string,
		},
		streams?: {
			codec_type?: string,
			codec_name?: string,
			nb_read_packets?: string,
		}[],
	}>(),
}
