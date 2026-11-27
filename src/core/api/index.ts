import { ApiConfiguration, ModelInfo } from "@shared/api"
import { Mode } from "@shared/storage/types"
import { ClineStorageMessage } from "@/shared/messages/content"
import { Logger } from "@/shared/services/Logger"
import { ClineTool } from "@/shared/tools"
import {
	MANUAL_AUTOCOPY_HEADER,
	MANUAL_BRIDGE_PORT_HEADER,
	MANUAL_BROWSER_BRIDGE_HEADER,
	MANUAL_MODE_BASE_URL_MARKER,
	MANUAL_UNIFIED_RULES_HEADER,
	ManualModeHandler,
} from "./providers/manual"
import { OpenAiHandler } from "./providers/openai"
import {
	dispatchNtfyForResponse,
	NTFY_LEVEL_HEADER,
	NTFY_TOPIC_HEADER,
	TALKTOLM_BASE_URL_MARKER,
	TalkToLlmHandler,
} from "./providers/talktollm"
import { ApiStream, ApiStreamUsageChunk } from "./transform/stream"

export type CommonApiHandlerOptions = {
	onRetryAttempt?: ApiConfiguration["onRetryAttempt"]
}
export interface ApiHandler {
	createMessage(systemPrompt: string, messages: ClineStorageMessage[], tools?: ClineTool[], useResponseApi?: boolean): ApiStream
	getModel(): ApiHandlerModel
	getApiStreamUsage?(): Promise<ApiStreamUsageChunk | undefined>
	abort?(): void
}

export interface ApiHandlerModel {
	id: string
	info: ModelInfo
}

export interface ApiProviderInfo {
	providerId: string
	model: ApiHandlerModel
	mode: Mode
	customPrompt?: string
}

export interface SingleCompletionHandler {
	completePrompt(prompt: string): Promise<string>
}

function wrapHandlerWithNtfy(handler: ApiHandler, headers?: Record<string, string>): ApiHandler {
	const ntfyLevel = (headers?.[NTFY_LEVEL_HEADER] || "none").toLowerCase()
	return {
		getModel: () => handler.getModel(),
		getApiStreamUsage: handler.getApiStreamUsage ? () => handler.getApiStreamUsage!() : undefined,
		abort: () => {
			TalkToLlmHandler.killActiveProcesses()
			ManualModeHandler.cancelPending("Request aborted.")
			handler.abort?.()
		},
		async *createMessage(
			systemPrompt: string,
			messages: ClineStorageMessage[],
			tools?: ClineTool[],
			useResponseApi?: boolean,
		): ApiStream {
			let effectiveSystemPrompt = systemPrompt
			if (ntfyLevel === "all") {
				effectiveSystemPrompt +=
					"\n\nYou MUST include a `<summary>` tag inside your `<thinking>` block for every tool call. This summary should be a very brief, user-friendly explanation of the action you are about to take. For example: `<summary>Reading the project's configuration to check dependencies.</summary>`."
			}
			let accumulatedText = ""
			const stream = handler.createMessage(effectiveSystemPrompt, messages, tools, useResponseApi)
			for await (const chunk of stream) {
				if (chunk.type === "text") {
					accumulatedText += chunk.text
				}
				yield chunk
			}
			if (accumulatedText) {
				await dispatchNtfyForResponse(accumulatedText, headers)
			}
		},
	}
}

function createHandlerForProvider(
	_apiProvider: string | undefined,
	options: Omit<ApiConfiguration, "apiProvider">,
	mode: Mode,
): ApiHandler {
	const modelId = mode === "plan" ? options.planModeOpenAiModelId : options.actModeOpenAiModelId
	const isTalkToLlm = options.openAiBaseUrl === TALKTOLM_BASE_URL_MARKER
	const isManualMode = options.openAiBaseUrl === MANUAL_MODE_BASE_URL_MARKER

	if (isTalkToLlm) {
		return new TalkToLlmHandler({
			onRetryAttempt: options.onRetryAttempt,
			modelId: modelId || "gemini",
			headers: options.openAiHeaders,
		})
	}

	if (isManualMode) {
		return new ManualModeHandler({
			onRetryAttempt: options.onRetryAttempt,
			modelId: modelId || "manual-mode",
			headers: options.openAiHeaders,
		})
	}

	const cleanHeaders = { ...(options.openAiHeaders || {}) }
	delete cleanHeaders[NTFY_TOPIC_HEADER]
	delete cleanHeaders[NTFY_LEVEL_HEADER]
	delete cleanHeaders[MANUAL_AUTOCOPY_HEADER]
	delete cleanHeaders[MANUAL_UNIFIED_RULES_HEADER]
	delete cleanHeaders[MANUAL_BROWSER_BRIDGE_HEADER]
	delete cleanHeaders[MANUAL_BRIDGE_PORT_HEADER]

	const openAiHandler = new OpenAiHandler({
		onRetryAttempt: options.onRetryAttempt,
		openAiApiKey: options.openAiApiKey,
		openAiBaseUrl: options.openAiBaseUrl,
		azureApiVersion: options.azureApiVersion,
		azureIdentity: options.azureIdentity,
		openAiHeaders: cleanHeaders,
		openAiModelId: modelId,
		openAiModelInfo: mode === "plan" ? options.planModeOpenAiModelInfo : options.actModeOpenAiModelInfo,
		reasoningEffort: mode === "plan" ? options.planModeReasoningEffort : options.actModeReasoningEffort,
	})

	return wrapHandlerWithNtfy(openAiHandler, options.openAiHeaders)
}

export function buildApiHandler(configuration: ApiConfiguration, mode: Mode): ApiHandler {
	const { planModeApiProvider, actModeApiProvider, ...options } = configuration

	const apiProvider = mode === "plan" ? planModeApiProvider : actModeApiProvider

	try {
		const thinkingBudgetTokens = mode === "plan" ? options.planModeThinkingBudgetTokens : options.actModeThinkingBudgetTokens
		if (thinkingBudgetTokens && thinkingBudgetTokens > 0) {
			const handler = createHandlerForProvider(apiProvider, options, mode)

			const modelInfo = handler.getModel().info
			if (modelInfo?.maxTokens && modelInfo.maxTokens > 0 && thinkingBudgetTokens > modelInfo.maxTokens) {
				const clippedValue = modelInfo.maxTokens - 1
				if (mode === "plan") {
					options.planModeThinkingBudgetTokens = clippedValue
				} else {
					options.actModeThinkingBudgetTokens = clippedValue
				}
			} else {
				return handler
			}
		}
	} catch (error) {
		Logger.error("buildApiHandler error:", error)
	}

	return createHandlerForProvider(apiProvider, options, mode)
}