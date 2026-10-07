type Mermaid = (typeof import("mermaid"))["default"]

let loader: Promise<Mermaid> | null = null
const loadMermaid = () => (loader ??= import("mermaid").then((m) => m.default))

const cache = new Map<string, string>()
const CACHE_LIMIT = 64
let counter = 0
// mermaid.initialize() is global, so renders run one at a time.
let queue: Promise<unknown> = Promise.resolve()

export function renderMermaid(
  code: string,
  theme: "light" | "dark"
): Promise<string> {
  const key = `${theme}\u0000${code}`
  const hit = cache.get(key)
  if (hit) return Promise.resolve(hit)

  const run = queue.then(async () => {
    const mermaid = await loadMermaid()
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: theme === "dark" ? "dark" : "neutral",
      fontFamily: '"Geist Variable", ui-sans-serif, system-ui, sans-serif',
    })
    const id = `mermaid-${++counter}`
    try {
      const { svg } = await mermaid.render(id, code)
      cache.set(key, svg)
      if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!)
      return svg
    } finally {
      // A failed render leaves its scratch container behind.
      document.getElementById(`d${id}`)?.remove()
    }
  })
  queue = run.catch(() => undefined)
  return run
}
