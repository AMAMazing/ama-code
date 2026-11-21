#!/usr/bin/env node

// Packages a clean .vsix with --no-dependencies and publishes it to the VS Code
// Marketplace (and optionally OpenVSX if OVSX_PAT is configured) with automatic
// exponential-backoff retries on transient socket errors such as read ECONNRESET.
//
// Usage:
//   node scripts/publish-marketplace.mjs                  # release channel
//   node scripts/publish-marketplace.mjs --pre-release    # pre-release channel
//   node scripts/publish-marketplace.mjs --package-only   # build .vsix without uploading

import { spawnSync } from "node:child_process"
import { copyFileSync, existsSync, readFileSync, rmSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..")

const isPrerelease = process.argv.includes("--pre-release")
const isPackageOnly = process.argv.includes("--package-only")
const skipOvsx = process.argv.includes("--skip-ovsx") || !process.env.OVSX_PAT

const readmePath = path.join(repoRoot, "README.md")
const marketplaceReadmePath = path.join(repoRoot, "README.marketplace.md")
const backupReadmePath = path.join(repoRoot, ".README.publish-backup.md")

function swapInMarketplaceReadme() {
	if (!existsSync(marketplaceReadmePath) || !existsSync(readmePath)) {
		return { swapped: false }
	}
	copyFileSync(readmePath, backupReadmePath)
	copyFileSync(marketplaceReadmePath, readmePath)
	return { swapped: true }
}

function restoreReadme(state) {
	if (!state?.swapped) {
		return
	}
	try {
		if (existsSync(backupReadmePath)) {
			copyFileSync(backupReadmePath, readmePath)
			rmSync(backupReadmePath, { force: true })
		}
	} catch (err) {
		console.error(`[publish-marketplace] Failed to restore README.md: ${err.message}`)
	}
}

function sleepSync(ms) {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function runWithRetry(label, cmd, args, maxAttempts = 4) {
	const isWin = process.platform === "win32"
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		console.log(`[publish-marketplace] ${label} (attempt ${attempt}/${maxAttempts})...`)
		const res = spawnSync(cmd, args, {
			cwd: repoRoot,
			stdio: "inherit",
			shell: isWin,
			env: {
				...process.env,
				NODE_OPTIONS: [process.env.NODE_OPTIONS, "--dns-result-order=ipv4first"].filter(Boolean).join(" "),
			},
		})
		if (res.status === 0) {
			return
		}
		if (attempt < maxAttempts) {
			const delayMs = attempt * 3000
			console.warn(
				`[publish-marketplace] ${label} failed (exit ${res.status ?? "unknown"}). Retrying in ${delayMs / 1000}s...`,
			)
			sleepSync(delayMs)
		} else {
			throw new Error(`${label} failed after ${maxAttempts} attempts (exit ${res.status ?? "unknown"})`)
		}
	}
}

const pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"))
const vsixFilename = `${pkg.name}-${pkg.version}.vsix`
const vsixPath = path.join(repoRoot, vsixFilename)

const swapState = swapInMarketplaceReadme()

const cleanupOnSignal = (exitCode) => () => {
	restoreReadme(swapState)
	process.exit(exitCode)
}
process.on("SIGINT", cleanupOnSignal(130))
process.on("SIGTERM", cleanupOnSignal(143))

try {
	const packageArgs = [
		"vsce",
		"package",
		"--no-dependencies",
		"--allow-package-secrets",
		"sendgrid",
		"--out",
		vsixPath,
	]
	if (isPrerelease) {
		packageArgs.push("--pre-release")
	}

	runWithRetry("Packaging VSIX", "npx", packageArgs, 2)

	if (!isPackageOnly) {
		const publishArgs = [
			"vsce",
			"publish",
			"--packagePath",
			vsixPath,
			"--no-dependencies",
			"--allow-package-secrets",
			"sendgrid",
		]
		if (isPrerelease) {
			publishArgs.push("--pre-release")
		}
		runWithRetry("Publishing VSIX to VS Code Marketplace", "npx", publishArgs, 4)

		if (!skipOvsx) {
			const ovsxArgs = ["ovsx", "publish", vsixPath]
			if (isPrerelease) {
				ovsxArgs.push("--pre-release")
			}
			runWithRetry("Publishing VSIX to OpenVSX", "npx", ovsxArgs, 3)
		}
	}
} finally {
	restoreReadme(swapState)
}