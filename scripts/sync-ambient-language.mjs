import { execFileSync } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")

const args = process.argv.slice(2)
const shouldPull = args.includes("--pull")
const sourceFlagIdx = args.indexOf("--source")
const sourceArg = sourceFlagIdx !== -1 ? args[sourceFlagIdx + 1] : undefined

const defaultRepoUrl = process.env.AMBIENT_LANGUAGE_REPO || "https://github.com/AMAMazing/ambientlanguage.git"
const ambientRepoDir = path.resolve(repoRoot, sourceArg || process.env.AMBIENT_LANGUAGE_DIR || "ambientlanguage")
const srcCoreDir = path.join(ambientRepoDir, "packages", "core")
const destCoreDir = path.join(repoRoot, "webview-ui", "public", "ambient-core")

function readGitCommit(repoPath) {
	try {
		const headPath = path.join(repoPath, ".git", "HEAD")
		if (!existsSync(headPath)) {
			return null
		}
		const head = readFileSync(headPath, "utf8").trim()
		if (head.startsWith("ref:")) {
			const refRel = head.slice(4).trim()
			const refPath = path.join(repoPath, ".git", refRel)
			if (existsSync(refPath)) {
				return readFileSync(refPath, "utf8").trim()
			}
			const packedPath = path.join(repoPath, ".git", "packed-refs")
			if (existsSync(packedPath)) {
				const line = readFileSync(packedPath, "utf8")
					.split(/\r?\n/)
					.find((l) => !l.startsWith("#") && l.endsWith(` ${refRel}`))
				if (line) {
					return line.split(" ")[0].trim()
				}
			}
			return null
		}
		return head
	} catch {
		return null
	}
}

function pullPrivateRepo() {
	if (existsSync(path.join(ambientRepoDir, ".git"))) {
		console.log(`[sync-ambient-language] Pulling latest updates in ${ambientRepoDir}...`)
		execFileSync("git", ["-C", ambientRepoDir, "pull", "--ff-only"], { stdio: "inherit" })
		return
	}

	if (!existsSync(ambientRepoDir)) {
		console.log(`[sync-ambient-language] Cloning ${defaultRepoUrl} into ${ambientRepoDir}...`)
		execFileSync("git", ["clone", defaultRepoUrl, ambientRepoDir], { stdio: "inherit" })
		return
	}

	console.warn(`[sync-ambient-language] ${ambientRepoDir} exists without a .git folder; skipping git pull.`)
}

function syncCoreFiles() {
	if (shouldPull) {
		pullPrivateRepo()
	}

	if (!existsSync(srcCoreDir)) {
		if (existsSync(path.join(destCoreDir, "app.js"))) {
			console.warn(
				`[sync-ambient-language] Source not found at ${srcCoreDir}; keeping existing synced files in ${path.relative(repoRoot, destCoreDir)}.`,
			)
			return
		}
		console.error(
			`[sync-ambient-language] Ambient Language core directory not found at ${srcCoreDir}. Run with --pull or set AMBIENT_LANGUAGE_DIR.`,
		)
		process.exit(1)
	}

	const srcEntries = readdirSync(srcCoreDir).filter((name) => statSync(path.join(srcCoreDir, name)).isFile())
	const keepSet = new Set([...srcEntries, "manifest.json"])

	mkdirSync(destCoreDir, { recursive: true })

	for (const existing of readdirSync(destCoreDir)) {
		if (!keepSet.has(existing)) {
			rmSync(path.join(destCoreDir, existing), { recursive: true, force: true })
		}
	}

	for (const file of srcEntries) {
		copyFileSync(path.join(srcCoreDir, file), path.join(destCoreDir, file))
	}

	const manifest = {
		syncedAt: new Date().toISOString(),
		sourceCommit: readGitCommit(ambientRepoDir),
		files: srcEntries,
	}
	writeFileSync(path.join(destCoreDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8")

	console.log(
		`[sync-ambient-language] Synced ${srcEntries.length} core files -> ${path.relative(repoRoot, destCoreDir)}${manifest.sourceCommit ? ` (${manifest.sourceCommit.slice(0, 7)})` : ""}`,
	)
}

syncCoreFiles()