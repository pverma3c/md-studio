import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "katex/dist/katex.min.css"
import "./index.css"
import App from "./App.tsx"
import { AppErrorBoundary } from "@/components/app-error-boundary.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider storageKey="md-studio:theme">
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </ThemeProvider>
  </StrictMode>
)
