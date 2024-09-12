import React from "react"
import ReactDOM from "react-dom/client"
import App from "./app/App"

const root = document.getElementById("root")

if (root) {
	ReactDOM.createRoot(root).render(
		<React.StrictMode>
			<App />
		</React.StrictMode>,
	)
}
else {
	// eslint-disable-next-line no-console
	console.error("No root element found")
}