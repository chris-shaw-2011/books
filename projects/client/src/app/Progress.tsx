import { Line } from "rc-progress"

interface Props {
	percent?: number | undefined,
	text: string,
	state?: "active" | "complete" | "error",
}

const Progress = ({ percent, text, state = "active" }: Props) => (
	<div>
		<div role="progressbar" aria-label={text} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
			<Line percent={percent ?? 0} strokeWidth={1} strokeColor={state === "error" ? "#FF0000" : state === "complete" ? "#00FF00" : "#0000FF"} />
		</div>
		<div role="status">{text}</div>
	</div>
)

export default Progress
