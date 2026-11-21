import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, watch, writeFileSync } from "node:fs"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react-swc"
import { join, resolve } from "path"
import { defineConfig, type Plugin, ViteDevServer } from "vite"

const VIRTUAL_AMBIENT_CORE_ID = "virtual:ambient-core"
const RESOLVED_VIRTUAL_AMBIENT_CORE_ID = `\0${VIRTUAL_AMBIENT_CORE_ID}`

// Sync Ambient Language core engine from ../ambientlanguage/packages/core -> ./public/ambient-core
const syncAmbientCoreFiles = () => {
	const srcDir = resolve(__dirname, "..", "ambientlanguage", "packages", "core")
	const destDir = resolve(__dirname, "public", "ambient-core")
	if (!existsSync(srcDir)) {
		return
	}
	const srcFiles = readdirSync(srcDir).filter((name) => statSync(join(srcDir, name)).isFile())
	const keepSet = new Set([...srcFiles, "manifest.json"])
	mkdirSync(destDir, { recursive: true })
	for (const existing of readdirSync(destDir)) {
		if (!keepSet.has(existing)) {
			rmSync(join(destDir, existing), { recursive: true, force: true })
		}
	}
	for (const file of srcFiles) {
		const srcPath = join(srcDir, file)
		const destPath = join(destDir, file)
		const srcStat = statSync(srcPath)
		const destStat = existsSync(destPath) ? statSync(destPath) : null
		if (!destStat || destStat.size !== srcStat.size || destStat.mtimeMs < srcStat.mtimeMs) {
			copyFileSync(srcPath, destPath)
		}
	}
}

const readAmbientCoreBundle = () => {
	syncAmbientCoreFiles()
	const repoCoreDir = resolve(__dirname, "..", "ambientlanguage", "packages", "core")
	const publicCoreDir = resolve(__dirname, "public", "ambient-core")
	const coreDir = existsSync(join(repoCoreDir, "app.js")) ? repoCoreDir : publicCoreDir

	const readAsset = (fileName: string): string => {
		const filePath = join(coreDir, fileName)
		return existsSync(filePath) ? readFileSync(filePath, "utf8") : ""
	}

	return {
		styleCss: readAsset("style.css"),
		phoneticsJs: readAsset("phonetics.js"),
		tutorialJs: readAsset("tutorial.js"),
		emojisJs: readAsset("emojis.js"),
		syncJs: readAsset("sync.js"),
		appJs: readAsset("app.js"),
	}
}

const syncAmbientCore = (): Plugin => {
	let watcher: ReturnType<typeof watch> | null = null
	let debounceTimer: ReturnType<typeof setTimeout> | null = null

	return {
		name: "sync-ambient-core",
		resolveId(id) {
			if (id === VIRTUAL_AMBIENT_CORE_ID) {
				return RESOLVED_VIRTUAL_AMBIENT_CORE_ID
			}
			return null
		},
		load(id) {
			if (id === RESOLVED_VIRTUAL_AMBIENT_CORE_ID) {
				return `export default ${JSON.stringify(readAmbientCoreBundle())}\n`
			}
			return null
		},
		buildStart() {
			syncAmbientCoreFiles()
		},
		configureServer(server: ViteDevServer) {
			syncAmbientCoreFiles()
			const srcDir = resolve(__dirname, "..", "ambientlanguage", "packages", "core")
			if (!existsSync(srcDir)) {
				return
			}
			try {
				watcher = watch(srcDir, () => {
					if (debounceTimer) {
						clearTimeout(debounceTimer)
					}
					debounceTimer = setTimeout(() => {
						syncAmbientCoreFiles()
						const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_AMBIENT_CORE_ID)
						if (mod) {
							server.moduleGraph.invalidateModule(mod)
							server.ws.send({ type: "full-reload" })
						}
					}, 120)
				})
				server.httpServer?.once("close", () => {
					watcher?.close()
					watcher = null
				})
			} catch {
				// Ignore watch errors on unsupported filesystems
			}
		},
	}
}

// Custom plugin to write the server port to a file
const writePortToFile = (): Plugin => {
	return {
		name: "write-port-to-file",
		configureServer(server: ViteDevServer) {
			server.httpServer?.once("listening", () => {
				const address = server.httpServer?.address()
				const port = typeof address === "object" && address ? address.port : null

				if (port) {
					const portFilePath = resolve(__dirname, ".vite-port")
					writeFileSync(portFilePath, port.toString())
				} else {
					console.warn("[writePortToFile] Could not determine server port")
				}
			})
		},
	}
}

const isDevBuild = process.argv.includes("--dev-build")
const platform = "vscode"

export default defineConfig({
	base: "./",
	optimizeDeps: {
		force: true,
	},
	plugins: [react(), tailwindcss(), syncAmbientCore(), writePortToFile()],
	build: {
		outDir: "build",
		reportCompressedSize: false,
		minify: !isDevBuild,
		sourcemap: isDevBuild ? "inline" : false,
		rollupOptions: {
			output: {
				inlineDynamicImports: true,
				entryFileNames: `assets/[name].js`,
				chunkFileNames: `assets/[name].js`,
				assetFileNames: `assets/[name].[ext]`,
				compact: !isDevBuild,
				...(isDevBuild && {
					generatedCode: {
						constBindings: false,
						objectShorthand: false,
						arrowFunctions: false,
					},
				}),
			},
		},
		chunkSizeWarningLimit: 100000,
	},
	server: {
		port: 25463,
		hmr: {
			host: "localhost",
			protocol: "ws",
		},
		cors: {
			origin: "*",
			methods: "*",
			allowedHeaders: "*",
		},
	},
	define: {
		__PLATFORM__: JSON.stringify(platform),
		process: JSON.stringify({
			platform: JSON.stringify(process?.platform),
			env: {
				NODE_ENV: JSON.stringify(process?.env?.IS_DEV ? "development" : "production"),
				CLINE_ENVIRONMENT: JSON.stringify(process?.env?.CLINE_ENVIRONMENT ?? "production"),
				IS_DEV: JSON.stringify(process?.env?.IS_DEV),
				IS_TEST: JSON.stringify(process?.env?.IS_TEST),
				CI: JSON.stringify(process?.env?.CI),
				TELEMETRY_SERVICE_API_KEY: JSON.stringify(process?.env?.TELEMETRY_SERVICE_API_KEY),
				ERROR_SERVICE_API_KEY: JSON.stringify(process?.env?.ERROR_SERVICE_API_KEY),
			},
		}),
	},
	resolve: {
		alias: {
			"@": resolve(__dirname, "./src"),
			"@components": resolve(__dirname, "./src/components"),
			"@context": resolve(__dirname, "./src/context"),
			"@shared": resolve(__dirname, "../src/shared"),
			"@utils": resolve(__dirname, "./src/utils"),
		},
	},
})