import { ModelInfo, openAiModelInfoSaneDefaults } from "@shared/api"
import type { ManualModeState } from "@shared/ExtensionMessage"
import { ClineStorageMessage } from "@/shared/messages/content"
import { Logger } from "@/shared/services/Logger"
import { readTextFromClipboard, writeTextToClipboard } from "@/utils/env"
import { ApiHandler, CommonApiHandlerOptions } from "../index"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStream } from "../transform/stream"
import { dispatchNtfyForResponse, NTFY_LEVEL_HEADER, normalizeTalkToLlmLineEndings } from "./talktollm"
import { getUnifiedRules } from "./unifiedRulesLoader"

export const MANUAL_MODE_BASE_URL_MARKER = "manual://local"

const FENCE = String.fromCharCode(96).repeat(3)

const XML_TOOL_NAMES = [
	"execute_command",
	"read_file",
	"write_to_file",
	"replace_in_file",
	"search_files",
	"list_files",
	"list_code_definition_names",
	"browser_action",
	"use_mcp_tool",
	"access_mcp_resource",
	"ask_followup_question",
	"attempt_completion",
	"plan_mode_respond",
	"new_task",
	"load_mcp_documentation",
	"generate_explanation",
]

export interface ManualModeHandlerOptions extends CommonApiHandlerOptions {
	modelId?: string
	headers?: Record<string, string>
}

function extractMessageText(content: unknown): string {
	if (typeof content === "string") {
		return content
	}
	if (Array.isArray(content)) {
		return content
			.map((part) => {
				if (part && typeof part === "object") {
					const record = part as Record<string, unknown>
					if (record.type === "text" && typeof record.text === "string") {
						return record.text
					}
					if (record.type === "image_url") {
						return "[Image attached]"
					}
				}
				return JSON.stringify(part)
			})
			.join("\n")
	}
	return content ? String(content) : ""
}

export async function formatMessagesToManualPrompt(
	openAiMessages: Array<{ role: string; content?: unknown }>,
): Promise<string> {
	const sections: string[] = []

	for (const msg of openAiMessages) {
		const role = (msg.role || "user").toUpperCase()
		const rawText = extractMessageText(msg.content)
		const sanitized = rawText.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, "[Image data omitted]")
		sections.push(
			`================================================================================\n[${role}]\n================================================================================\n${sanitized}`,
		)
	}

	const rulesText = await getUnifiedRules()
	if (rulesText) {
		sections.push(
			`================================================================================\n[CRITICAL OUTPUT PROTOCOL & OVERRIDE INSTRUCTIONS]\n================================================================================\n${rulesText}`,
		)
	}

	return sections.join("\n\n")
}

export function parseAndQueueLLMResponse(rawText: string): string[] {
	let cleaned = normalizeTalkToLlmLineEndings(rawText).trim()

	if (cleaned.startsWith(FENCE)) {
		const firstNewline = cleaned.indexOf("\n")
		cleaned = firstNewline !== -1 ? cleaned.slice(firstNewline + 1) : cleaned.slice(3)
	}
	if (cleaned.endsWith(FENCE)) {
		cleaned = cleaned.slice(0, -3)
	}
	cleaned = cleaned.trim()

	let thinkingBlock = ""
	const thinkingMatch = cleaned.match(/<thinking>[\s\S]*?<\/thinking>/)
	if (thinkingMatch) {
		thinkingBlock = thinkingMatch[0]
		cleaned = cleaned.replace(thinkingMatch[0], "").trim()
	}

	const toolRegex = new RegExp(`<(${XML_TOOL_NAMES.join("|")})>[\\s\\S]*?<\\/\\1>`, "g")
	const matches = [...cleaned.matchAll(toolRegex)]

	if (matches.length <= 1) {
		const full = [thinkingBlock, cleaned].filter(Boolean).join("\n\n")
		return [full]
	}

	const steps = matches.map((match, idx) => {
		if (idx === 0 && thinkingBlock) {
			return `${thinkingBlock}\n${match[0]}`
		}
		return match[0]
	})

	Logger.log(
		`[AMA Code Manual Mode] Multi-tool compiler detected ${steps.length} batched tool calls; queuing ${steps.length - 1} follow-up tool(s).`,
	)
	return steps
}

export class ManualModeHandler implements ApiHandler {
	private options: ManualModeHandlerOptions

	private static pendingResolver: ((value: string) => void) | null = null
	private static pendingRejecter: ((reason?: unknown) => void) | null = null
	private static latestCompiledPrompt = ""
	private static promptVersion = 0
	private static toolBatchQueue: string[] = []
	private static lastError: string | undefined = undefined
	private static stateChangeListener: ((state: ManualModeState) => void) | null = null

	constructor(options: ManualModeHandlerOptions) {
		this.options = options
	}

	public static setStateChangeListener(listener: ((state: ManualModeState) => void) | null): void {
		ManualModeHandler.stateChangeListener = listener
		if (listener) {
			ManualModeHandler.notifyStateChange()
		}
	}

	public static getState(): ManualModeState {
		return {
			waiting: Boolean(ManualModeHandler.pendingResolver),
			hasPrompt: Boolean(ManualModeHandler.latestCompiledPrompt),
			version: ManualModeHandler.promptVersion,
			queuedTools: ManualModeHandler.toolBatchQueue.length,
			error: ManualModeHandler.lastError,
		}
	}

	private static notifyStateChange(): void {
		try {
			ManualModeHandler.stateChangeListener?.(ManualModeHandler.getState())
		} catch (err) {
			Logger.warn(`[AMA Code Manual Mode] Failed to push state update: ${err}`)
		}
	}

	public static resetState(): void {
		const reject = ManualModeHandler.pendingRejecter
		ManualModeHandler.pendingResolver = null
		ManualModeHandler.pendingRejecter = null
		ManualModeHandler.toolBatchQueue = []
		ManualModeHandler.latestCompiledPrompt = ""
		ManualModeHandler.lastError = undefined
		ManualModeHandler.notifyStateChange()
		if (reject) {
			reject(new Error("Manual Mode task cleared."))
		}
	}

	public static cancelPending(reason = "Manual Mode request cancelled."): void {
		ManualModeHandler.toolBatchQueue = []
		ManualModeHandler.lastError = undefined
		const reject = ManualModeHandler.pendingRejecter
		ManualModeHandler.pendingResolver = null
		ManualModeHandler.pendingRejecter = null
		ManualModeHandler.notifyStateChange()
		if (reject) {
			reject(new Error(reason))
		}
	}

	public static async copyLatestPromptToClipboard(): Promise<boolean> {
		if (!ManualModeHandler.latestCompiledPrompt) {
			ManualModeHandler.lastError = "No compiled prompt available yet."
			ManualModeHandler.notifyStateChange()
			return false
		}
		try {
			await writeTextToClipboard(ManualModeHandler.latestCompiledPrompt)
			ManualModeHandler.lastError = undefined
			ManualModeHandler.notifyStateChange()
			return true
		} catch (err) {
			ManualModeHandler.lastError = `Failed to copy prompt: ${err instanceof Error ? err.message : String(err)}`
			ManualModeHandler.notifyStateChange()
			return false
		}
	}

	public static async pasteAndSubmitFromClipboard(): Promise<{ ok: boolean; batchCount?: number; error?: string }> {
		if (!ManualModeHandler.pendingResolver) {
			const error = "Not currently waiting for a response."
			ManualModeHandler.lastError = error
			ManualModeHandler.notifyStateChange()
			return { ok: false, error }
		}

		let clipText = ""
		try {
			clipText = await readTextFromClipboard()
		} catch (err) {
			const error = `Failed to read clipboard: ${err instanceof Error ? err.message : String(err)}`
			ManualModeHandler.lastError = error
			ManualModeHandler.notifyStateChange()
			return { ok: false, error }
		}

		if (!clipText || !clipText.trim()) {
			const error = "Clipboard is empty. Copy the LLM response first."
			ManualModeHandler.lastError = error
			ManualModeHandler.notifyStateChange()
			return { ok: false, error }
		}

		return ManualModeHandler.submitResponse(clipText)
	}

	public static submitResponse(rawText: string): { ok: boolean; batchCount?: number; error?: string } {
		if (!ManualModeHandler.pendingResolver) {
			return { ok: false, error: "Not currently waiting for a response." }
		}
		if (!rawText || !rawText.trim()) {
			ManualModeHandler.lastError = "Clipboard is empty. Copy the LLM response first."
			ManualModeHandler.notifyStateChange()
			return { ok: false, error: ManualModeHandler.lastError }
		}

		const steps = parseAndQueueLLMResponse(rawText)
		const firstStep = steps.shift() || ""
		ManualModeHandler.toolBatchQueue = steps
		ManualModeHandler.lastError = undefined

		const resolve = ManualModeHandler.pendingResolver
		ManualModeHandler.pendingResolver = null
		ManualModeHandler.pendingRejecter = null
		ManualModeHandler.notifyStateChange()

		resolve(firstStep)
		return { ok: true, batchCount: steps.length + 1 }
	}

	public static disposeAll(): void {
		ManualModeHandler.resetState()
		ManualModeHandler.stateChangeListener = null
	}

	abort(): void {
		ManualModeHandler.cancelPending("Manual Mode request aborted.")
	}

	async *createMessage(systemPrompt: string, messages: ClineStorageMessage[]): ApiStream {
		const headers = this.options.headers || {}
		const ntfyLevel = (headers[NTFY_LEVEL_HEADER] || "none").toLowerCase()

		let effectiveSystemPrompt = systemPrompt
		if (ntfyLevel === "all") {
			effectiveSystemPrompt +=
				"\n\nYou MUST include a `<summary>` tag inside your `<thinking>` block for every tool call. This summary should be a very brief, user-friendly explanation of the action you are about to take. For example: `<summary>Reading the project's configuration to check dependencies.</summary>`."
		}

		const openAiMessages = [
			{ role: "system", content: effectiveSystemPrompt },
			...convertToOpenAiMessages(messages),
		]

		const lastMsg = openAiMessages[openAiMessages.length - 1]
		const lastContentStr = extractMessageText(lastMsg?.content)
		const hasError =
			lastContentStr.includes("Error executing") ||
			lastContentStr.includes("The user denied") ||
			lastContentStr.includes("The user rejected")

		if (ManualModeHandler.toolBatchQueue.length > 0 && !hasError) {
			const nextToolXml = ManualModeHandler.toolBatchQueue.shift() || ""
			ManualModeHandler.lastError = undefined
			ManualModeHandler.notifyStateChange()

			const normalized = normalizeTalkToLlmLineEndings(nextToolXml)
			await dispatchNtfyForResponse(normalized, this.options.headers)

			for (const segment of normalized.split(/(\n)/)) {
				if (segment) {
					yield { type: "text", text: segment }
				}
			}
			yield {
				type: "usage",
				inputTokens: Math.ceil(effectiveSystemPrompt.length / 4),
				outputTokens: Math.ceil(normalized.length / 4),
			}
			return
		}

		if (hasError && ManualModeHandler.toolBatchQueue.length > 0) {
			Logger.log(
				`[AMA Code Manual Mode] Tool error or denial detected; clearing ${ManualModeHandler.toolBatchQueue.length} queued tool(s).`,
			)
			ManualModeHandler.toolBatchQueue = []
		}

		if (ManualModeHandler.pendingRejecter) {
			ManualModeHandler.pendingRejecter(new Error("Superseded by a newer Manual Mode request."))
			ManualModeHandler.pendingResolver = null
			ManualModeHandler.pendingRejecter = null
		}

		const compiledPrompt = await formatMessagesToManualPrompt(openAiMessages)
		ManualModeHandler.latestCompiledPrompt = compiledPrompt
		ManualModeHandler.promptVersion += 1
		ManualModeHandler.lastError = undefined

		try {
			await writeTextToClipboard(compiledPrompt)
		} catch (err) {
			Logger.warn(`[AMA Code Manual Mode] Failed to auto-copy prompt to clipboard: ${err}`)
		}

		const responseText = await new Promise<string>((resolve, reject) => {
			ManualModeHandler.pendingResolver = resolve
			ManualModeHandler.pendingRejecter = reject
			ManualModeHandler.notifyStateChange()
		})

		const normalizedResponse = normalizeTalkToLlmLineEndings(responseText)
		await dispatchNtfyForResponse(normalizedResponse, this.options.headers)

		for (const segment of normalizedResponse.split(/(\n)/)) {
			if (segment) {
				yield { type: "text", text: segment }
			}
		}

		yield {
			type: "usage",
			inputTokens: Math.ceil(compiledPrompt.length / 4),
			outputTokens: Math.ceil(normalizedResponse.length / 4),
		}
	}

	getModel(): { id: string; info: ModelInfo } {
		return {
			id: this.options.modelId || "manual-mode",
			info: {
				...openAiModelInfoSaneDefaults,
				supportsImages: true,
			},
		}
	}
}