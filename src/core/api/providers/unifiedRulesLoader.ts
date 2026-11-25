import * as fs from "node:fs"
import * as fsp from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { HostProvider } from "@/hosts/host-provider"
import { fetch } from "@/shared/net"
import { Logger } from "@/shared/services/Logger"
import { UNIFIED_RULES_CONTENT } from "./unifiedRules"

export const DEFAULT_UNIFIED_RULES_URL =
	"https://raw.githubusercontent.com/AMAMazing/ama-code/main/unified-rules.md"

const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000
const FETCH_TIMEOUT_MS = 3000
const MIN_VALID_RULES_LENGTH = 100
const REQUIRED_RULES_MARKER = "CRITICAL OUTPUT PROTOCOL"

interface UnifiedRulesCacheEntry {
	url: string
	content: string
	etag?: string
	fetchedAt: number
}

let memoryCache: UnifiedRulesCacheEntry | null = null
let diskCacheLoaded = false
let inFlightRefresh: Promise<UnifiedRulesCacheEntry | null> | null = null

function normalizeRulesText(text: string): string {
	return text.replace(/\r+\n/g, "\n").replace(/\r/g, "\n").trim()
}

function getTargetRulesUrl(): string {
	const envUrl = process.env.AMA_UNIFIED_RULES_URL?.trim()
	return envUrl || DEFAULT_UNIFIED_RULES_URL
}

function getCacheTtlMs(): number {
	const raw = process.env.AMA_UNIFIED_RULES_TTL_MS?.trim()
	if (raw) {
		const parsed = Number(raw)
		if (Number.isFinite(parsed) && parsed >= 0) {
			return parsed
		}
	}
	return DEFAULT_CACHE_TTL_MS
}

function getCacheFilePath(): string {
	try {
		if (HostProvider.isInitialized()) {
			return path.join(HostProvider.get().globalStorageFsPath, "cache", "unified-rules-cache.json")
		}
	} catch {
		// Fall back to user home directory if HostProvider is unavailable
	}
	return path.join(os.homedir(), ".ama-code", "unified-rules-cache.json")
}

function getLocalOverridePaths(): string[] {
	const paths: string[] = []
	const envPath = process.env.AMA_UNIFIED_RULES_PATH?.trim()
	if (envPath) {
		paths.push(path.resolve(envPath))
	}
	paths.push(path.join(os.homedir(), ".ama-code", "unified-rules.md"))
	return paths
}

export function isValidRemoteUnifiedRules(content: string): boolean {
	if (!content || content.length < MIN_VALID_RULES_LENGTH) {
		return false
	}
	const lowerHead = content.slice(0, 64).trimStart().toLowerCase()
	if (lowerHead.startsWith("<!doctype") || lowerHead.startsWith("<html")) {
		return false
	}
	return content.includes(REQUIRED_RULES_MARKER)
}

async function readLocalOverrideRules(): Promise<string | null> {
	for (const candidate of getLocalOverridePaths()) {
		try {
			if (!fs.existsSync(candidate)) {
				continue
			}
			const raw = await fsp.readFile(candidate, "utf-8")
			const normalized = normalizeRulesText(raw)
			if (normalized) {
				return normalized
			}
		} catch (error) {
			Logger.warn(`[AMA Code unified-rules] Failed to read local override at ${candidate}: ${error}`)
		}
	}
	return null
}

async function loadDiskCache(expectedUrl: string): Promise<UnifiedRulesCacheEntry | null> {
	if (diskCacheLoaded) {
		return memoryCache && memoryCache.url === expectedUrl ? memoryCache : null
	}
	diskCacheLoaded = true
	const cachePath = getCacheFilePath()
	try {
		if (!fs.existsSync(cachePath)) {
			return null
		}
		const raw = await fsp.readFile(cachePath, "utf-8")
		const parsed = JSON.parse(raw) as Partial<UnifiedRulesCacheEntry>
		if (
			typeof parsed.url === "string" &&
			typeof parsed.content === "string" &&
			typeof parsed.fetchedAt === "number" &&
			isValidRemoteUnifiedRules(parsed.content)
		) {
			memoryCache = {
				url: parsed.url,
				content: normalizeRulesText(parsed.content),
				etag: typeof parsed.etag === "string" ? parsed.etag : undefined,
				fetchedAt: parsed.fetchedAt,
			}
			return memoryCache.url === expectedUrl ? memoryCache : null
		}
	} catch (error) {
		Logger.warn(`[AMA Code unified-rules] Failed to read disk cache: ${error}`)
	}
	return null
}

async function saveDiskCache(entry: UnifiedRulesCacheEntry): Promise<void> {
	memoryCache = entry
	diskCacheLoaded = true
	const cachePath = getCacheFilePath()
	try {
		await fsp.mkdir(path.dirname(cachePath), { recursive: true })
		await fsp.writeFile(cachePath, JSON.stringify(entry, null, 2), "utf-8")
	} catch (error) {
		Logger.warn(`[AMA Code unified-rules] Failed to persist disk cache: ${error}`)
	}
}

async function refreshUnifiedRulesFromRemote(
	url: string,
	cached: UnifiedRulesCacheEntry | null,
): Promise<UnifiedRulesCacheEntry | null> {
	if (inFlightRefresh) {
		return inFlightRefresh
	}

	inFlightRefresh = (async () => {
		const controller = new AbortController()
		const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
		try {
			const headers: Record<string, string> = {
				Accept: "text/plain",
				"Cache-Control": "no-cache",
			}
			if (cached?.etag && cached.url === url) {
				headers["If-None-Match"] = cached.etag
			}

			const response = await fetch(url, {
				method: "GET",
				headers,
				signal: controller.signal,
			})

			if (response.status === 304 && cached && cached.url === url) {
				const refreshed: UnifiedRulesCacheEntry = {
					...cached,
					fetchedAt: Date.now(),
				}
				await saveDiskCache(refreshed)
				return refreshed
			}

			if (!response.ok) {
				Logger.warn(`[AMA Code unified-rules] Remote fetch returned HTTP ${response.status} from ${url}`)
				return null
			}

			const text = normalizeRulesText(await response.text())
			if (!isValidRemoteUnifiedRules(text)) {
				Logger.warn(`[AMA Code unified-rules] Remote payload from ${url} failed validation; ignoring`)
				return null
			}

			const updated: UnifiedRulesCacheEntry = {
				url,
				content: text,
				etag: response.headers.get("etag") || undefined,
				fetchedAt: Date.now(),
			}
			await saveDiskCache(updated)
			return updated
		} catch (error) {
			Logger.warn(`[AMA Code unified-rules] Remote fetch failed (${url}): ${error}`)
			return null
		} finally {
			clearTimeout(timeout)
			inFlightRefresh = null
		}
	})()

	return inFlightRefresh
}

export async function getUnifiedRules(): Promise<string> {
	const localOverride = await readLocalOverrideRules()
	if (localOverride) {
		return localOverride
	}

	const url = getTargetRulesUrl()
	const cached = await loadDiskCache(url)
	const ttlMs = getCacheTtlMs()

	if (cached) {
		if (Date.now() - cached.fetchedAt >= ttlMs) {
			void refreshUnifiedRulesFromRemote(url, cached)
		}
		return cached.content
	}

	const fetched = await refreshUnifiedRulesFromRemote(url, null)
	if (fetched) {
		return fetched.content
	}

	return UNIFIED_RULES_CONTENT
}

export async function warmUpUnifiedRules(): Promise<void> {
	try {
		const url = getTargetRulesUrl()
		const cached = await loadDiskCache(url)
		if (!cached || Date.now() - cached.fetchedAt >= getCacheTtlMs()) {
			await refreshUnifiedRulesFromRemote(url, cached)
		}
	} catch (error) {
		Logger.warn(`[AMA Code unified-rules] Startup warm-up failed: ${error}`)
	}
}