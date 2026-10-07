// Bumps the app version everywhere, commits, tags and pushes. GitHub Actions
// then builds the release, and installed copies offer it as an update.
//
//   npm run release -- 0.2.0 "What changed (Markdown, shown in the update dialog)"
import { execFileSync } from "node:child_process"
import fs from "node:fs"

const [version, ...noteParts] = process.argv.slice(2)
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version ?? "")) {
  console.error('Usage: npm run release -- <version> ["release notes"]')
  process.exit(1)
}
const notes = noteParts.join(" ").trim() || `MD Studio ${version}`
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim()

if (git("status", "--porcelain")) {
  console.error(
    "Commit or stash your changes first; a release is cut from a clean tree."
  )
  process.exit(1)
}
if (git("tag", "-l", `v${version}`)) {
  console.error(`Tag v${version} already exists.`)
  process.exit(1)
}

const editJson = (file, edit) => {
  const data = JSON.parse(fs.readFileSync(file, "utf8"))
  edit(data)
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n")
}
const editText = (file, pattern, replacement) =>
  fs.writeFileSync(
    file,
    fs.readFileSync(file, "utf8").replace(pattern, replacement)
  )

editJson("package.json", (pkg) => {
  pkg.version = version
})
editJson("package-lock.json", (lock) => {
  lock.version = version
  if (lock.packages?.[""]) lock.packages[""].version = version
})
editJson("src-tauri/tauri.conf.json", (conf) => {
  conf.version = version
})
editText("src-tauri/Cargo.toml", /^version = ".*"$/m, `version = "${version}"`)
editText(
  "src-tauri/Cargo.lock",
  /(name = "md-studio"\nversion = )".*"/,
  `$1"${version}"`
)

const files = [
  "package.json",
  "package-lock.json",
  "src-tauri/tauri.conf.json",
  "src-tauri/Cargo.toml",
  "src-tauri/Cargo.lock",
]
git("add", ...files)
git("commit", "-m", `Release v${version}`)
git("tag", "-a", `v${version}`, "-m", notes)
git("push", "origin", "HEAD")
git("push", "origin", `v${version}`)
console.log(
  `Pushed v${version}. Watch the build at https://github.com/pverma3c/md-studio/actions`
)
