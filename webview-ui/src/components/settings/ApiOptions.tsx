import { Mode } from "@shared/storage/types"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { useEffect } from "react"
import styled from "styled-components"
import { normalizeApiConfiguration } from "@/components/settings/utils/providerUtils"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { OPENROUTER_MODEL_PICKER_Z_INDEX } from "./OpenRouterModelPicker"
import { OpenAICompatibleProvider } from "./providers/OpenAICompatible"
import { useApiConfigurationHandlers } from "./utils/useApiConfigurationHandlers"

export const TALKTOLM_BASE_URL_MARKER = "talktollm://local"
export const MANUAL_MODE_BASE_URL_MARKER = "manual://local"

const MANUAL_AUTOCOPY_HEADER = "x-amacs-manual-autocopy"
const MANUAL_UNIFIED_RULES_HEADER = "x-amacs-manual-unified-rules"
const MANUAL_BROWSER_BRIDGE_HEADER = "x-amacs-manual-browser-bridge"
const MANUAL_BRIDGE_PORT_HEADER = "x-amacs-manual-bridge-port"

type ProviderMode = "openai" | "talktollm" | "manual"

const AISTUDIO_SUBMODELS = [
	{ value: "aistudio-carbon", label: "Gemini 4 Carbon", aliases: ["aistudio-carbon", "gemini-4-carbon"] },
	{ value: "aistudio-neon", label: "Gemini 4 Neon", aliases: ["aistudio-neon", "gemini-4-neon"] },
	{ value: "aistudio-argon", label: "Gemini 4 Argon", aliases: ["aistudio-argon", "gemini-4-argon"] },
	{ value: "aistudio-hydrogen", label: "Gemini 4 Hydrogen", aliases: ["aistudio-hydrogen", "gemini-4-hydrogen"] },
	{ value: "aistudio-pro", label: "Gemini Pro", aliases: ["aistudio", "aistudio-pro"] },
	{ value: "aistudio-flash", label: "Gemini Flash", aliases: ["aistudio_flash", "aistudio-flash"] },
	{ value: "aistudio-flash-lite", label: "Gemini Flash Lite", aliases: ["gemini-3.1-flash-lite-preview", "aistudio-flash-lite"] },
]

const AISTUDIO_ALL_IDS = new Set(AISTUDIO_SUBMODELS.flatMap((m) => m.aliases))

interface ApiOptionsProps {
	showModelOptions: boolean
	apiErrorMessage?: string
	modelIdErrorMessage?: string
	isPopup?: boolean
	currentMode: Mode
	initialModelTab?: "recommended" | "free"
}

export const DROPDOWN_Z_INDEX = OPENROUTER_MODEL_PICKER_Z_INDEX + 2

export const DropdownContainer = styled.div<{ zIndex?: number }>`
	position: relative;
	z-index: ${(props) => props.zIndex || DROPDOWN_Z_INDEX};

	& vscode-dropdown::part(listbox) {
		position: absolute !important;
		top: 100% !important;
		bottom: auto !important;
	}
`

const FieldLabel = styled.label`
	display: block;
	margin-bottom: 6px;
	font-size: 12px;
	font-weight: 500;
`

const OptionList = styled.div`
	display: flex;
	flex-direction: column;
	gap: 4px;
`

/** Full-width, wrapping radio-style row. Works at any sidebar width. */
const OptionRow = styled.button<{ $active: boolean }>`
	display: flex;
	align-items: flex-start;
	gap: 8px;
	width: 100%;
	padding: 7px 9px;
	text-align: left;
	cursor: pointer;
	border-radius: 4px;
	border: 1px solid ${(p) => (p.$active ? "var(--vscode-focusBorder)" : "var(--vscode-dropdown-border)")};
	background: ${(p) =>
		p.$active ? "color-mix(in srgb, var(--vscode-focusBorder) 14%, var(--vscode-input-background))" : "var(--vscode-input-background)"};
	color: var(--vscode-foreground);
	transition: border-color 0.12s ease, background-color 0.12s ease;

	&:hover {
		border-color: var(--vscode-focusBorder);
	}
	&:focus-visible {
		outline: 1px solid var(--vscode-focusBorder);
		outline-offset: 1px;
	}
`

const RadioDot = styled.span<{ $active: boolean }>`
	flex-shrink: 0;
	width: 12px;
	height: 12px;
	margin-top: 2px;
	border-radius: 50%;
	box-sizing: border-box;
	border: 1px solid ${(p) => (p.$active ? "var(--vscode-focusBorder)" : "var(--vscode-descriptionForeground)")};
	background: ${(p) => (p.$active ? "var(--vscode-focusBorder)" : "transparent")};
	box-shadow: ${(p) => (p.$active ? "inset 0 0 0 2px var(--vscode-input-background)" : "none")};
`

const OptionText = styled.span`
	display: flex;
	flex-direction: column;
	min-width: 0;
	gap: 1px;
`

const OptionTitle = styled.span`
	font-size: 12px;
	font-weight: 500;
	line-height: 1.3;
`

const OptionHint = styled.span`
	font-size: 10.5px;
	line-height: 1.3;
	color: var(--vscode-descriptionForeground);
`

/** Auto-wrapping chip grid: 3 across when wide, 2 or 1 when the sidebar is narrow. */
const ChipGrid = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
	gap: 4px;
`

const Chip = styled.button<{ $active: boolean }>`
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 5px;
	padding: 6px 8px;
	font-size: 12px;
	font-weight: 500;
	line-height: 1.2;
	cursor: pointer;
	border-radius: 4px;
	border: 1px solid ${(p) => (p.$active ? "var(--vscode-button-background)" : "var(--vscode-dropdown-border)")};
	background: ${(p) => (p.$active ? "var(--vscode-button-background)" : "var(--vscode-input-background)")};
	color: ${(p) => (p.$active ? "var(--vscode-button-foreground)" : "var(--vscode-foreground)")};
	transition: background-color 0.12s ease, border-color 0.12s ease;

	&:hover:not([aria-checked="true"]) {
		border-color: var(--vscode-focusBorder);
	}
	&:focus-visible {
		outline: 1px solid var(--vscode-focusBorder);
		outline-offset: 1px;
	}
`

const StyledSelect = styled.select`
	width: 100%;
	box-sizing: border-box;
	padding: 6px 8px;
	border-radius: 4px;
	font-size: 12px;
	cursor: pointer;
	background-color: var(--vscode-dropdown-background);
	color: var(--vscode-dropdown-foreground);
	border: 1px solid var(--vscode-dropdown-border);

	&:focus-visible {
		outline: 1px solid var(--vscode-focusBorder);
		outline-offset: -1px;
	}
`

const ManualCard = styled.div`
	display: flex;
	flex-direction: column;
	gap: 10px;
	padding: 10px;
	border-radius: 4px;
	border: 1px solid var(--vscode-dropdown-border);
	background: var(--vscode-input-background);
`

const ManualHint = styled.p`
	margin: 0;
	font-size: 11px;
	line-height: 1.45;
	color: var(--vscode-descriptionForeground);
`

const PortRow = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
	margin-top: 2px;
`

const PortInput = styled.input`
	width: 96px;
	padding: 4px 8px;
	border-radius: 4px;
	font-size: 12px;
	background-color: var(--vscode-editor-background);
	color: var(--vscode-input-foreground);
	border: 1px solid var(--vscode-dropdown-border);

	&:focus-visible {
		outline: 1px solid var(--vscode-focusBorder);
		border-color: var(--vscode-focusBorder);
	}
`

declare module "vscode" {
	interface LanguageModelChatSelector {
		vendor?: string
		family?: string
		version?: string
		id?: string
	}
}

const ApiOptions = ({
	showModelOptions,
	apiErrorMessage,
	modelIdErrorMessage,
	isPopup,
	currentMode,
}: ApiOptionsProps) => {
	const { apiConfiguration } = useExtensionState()
	const { selectedProvider } = normalizeApiConfiguration(apiConfiguration, currentMode)
	const { handleFieldsChange, handleModeFieldChange } = useApiConfigurationHandlers()

	const isTalkToLlm = apiConfiguration?.openAiBaseUrl === TALKTOLM_BASE_URL_MARKER
	const isManualMode = apiConfiguration?.openAiBaseUrl === MANUAL_MODE_BASE_URL_MARKER
	const activeProviderMode: ProviderMode = isTalkToLlm ? "talktollm" : isManualMode ? "manual" : "openai"

	const currentModel =
		(currentMode === "plan" ? apiConfiguration?.planModeOpenAiModelId : apiConfiguration?.actModeOpenAiModelId) || "gemini"
	const isAiStudioModel = AISTUDIO_ALL_IDS.has(currentModel)

	const manualHeaders = apiConfiguration?.openAiHeaders || {}
	const manualAutoCopy = manualHeaders[MANUAL_AUTOCOPY_HEADER] !== "false"
	const manualIncludeUnifiedRules = manualHeaders[MANUAL_UNIFIED_RULES_HEADER] !== "false"
	const manualBrowserBridge = manualHeaders[MANUAL_BROWSER_BRIDGE_HEADER] === "true"
	const manualBridgePort = manualHeaders[MANUAL_BRIDGE_PORT_HEADER] || "4000"

	useEffect(() => {
		if (selectedProvider !== "openai") {
			handleModeFieldChange({ plan: "planModeApiProvider", act: "actModeApiProvider" }, "openai", currentMode)
		}
	}, [selectedProvider, currentMode, handleModeFieldChange])

	const selectProviderMode = async (target: ProviderMode) => {
		if (target === "talktollm") {
			const defaultTalkModel =
				currentModel && (currentModel === "gemini" || currentModel === "deepseek" || AISTUDIO_ALL_IDS.has(currentModel))
					? currentModel
					: "gemini"
			await handleFieldsChange({
				planModeApiProvider: "openai",
				actModeApiProvider: "openai",
				openAiBaseUrl: TALKTOLM_BASE_URL_MARKER,
				openAiApiKey: "talktollm-local",
				planModeOpenAiModelId: defaultTalkModel,
				actModeOpenAiModelId: defaultTalkModel,
			})
		} else if (target === "manual") {
			await handleFieldsChange({
				planModeApiProvider: "openai",
				actModeApiProvider: "openai",
				openAiBaseUrl: MANUAL_MODE_BASE_URL_MARKER,
				openAiApiKey: "manual-local",
				planModeOpenAiModelId: "manual-mode",
				actModeOpenAiModelId: "manual-mode",
			})
		} else {
			const isSpecialMarker =
				apiConfiguration?.openAiBaseUrl === TALKTOLM_BASE_URL_MARKER ||
				apiConfiguration?.openAiBaseUrl === MANUAL_MODE_BASE_URL_MARKER
			const isPlaceholderKey =
				apiConfiguration?.openAiApiKey === "talktollm-local" || apiConfiguration?.openAiApiKey === "manual-local"
			await handleFieldsChange({
				planModeApiProvider: "openai",
				actModeApiProvider: "openai",
				openAiBaseUrl: isSpecialMarker ? "" : apiConfiguration?.openAiBaseUrl,
				openAiApiKey: isPlaceholderKey ? "" : apiConfiguration?.openAiApiKey,
				...(apiConfiguration?.planModeOpenAiModelId === "manual-mode" ? { planModeOpenAiModelId: "" } : {}),
				...(apiConfiguration?.actModeOpenAiModelId === "manual-mode" ? { actModeOpenAiModelId: "" } : {}),
			})
		}
	}

	const selectTalkToLlmModel = async (model: string) => {
		let targetModel = model
		if (model === "aistudio") {
			const matchingSub = AISTUDIO_SUBMODELS.find((m) => m.aliases.includes(currentModel))
			targetModel = matchingSub ? matchingSub.value : "aistudio-carbon"
		}
		await handleFieldsChange({
			openAiBaseUrl: TALKTOLM_BASE_URL_MARKER,
			openAiApiKey: "talktollm-local",
			planModeOpenAiModelId: targetModel,
			actModeOpenAiModelId: targetModel,
		})
	}

	const updateManualHeader = async (key: string, value: string) => {
		await handleFieldsChange({
			openAiHeaders: {
				...(apiConfiguration?.openAiHeaders || {}),
				[key]: value,
			},
		})
	}

	const activeAiStudioValue =
		AISTUDIO_SUBMODELS.find((m) => m.aliases.includes(currentModel))?.value || "aistudio-carbon"

	const modelChoices = [
		{ id: "gemini", label: "🧠 Gemini", active: currentModel === "gemini" },
		{ id: "deepseek", label: "🔍 DeepSeek", active: currentModel === "deepseek" },
		{ id: "aistudio", label: "🎨 AIStudio", active: isAiStudioModel },
	] as const

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: isPopup ? -10 : 0 }}>
			<div>
				<FieldLabel id="api-provider-label">API Provider</FieldLabel>
				<OptionList aria-labelledby="api-provider-label" data-testid="provider-selector-input" id="api-provider" role="radiogroup">
					<OptionRow
						$active={activeProviderMode === "openai"}
						aria-checked={activeProviderMode === "openai"}
						onClick={() => selectProviderMode("openai")}
						role="radio"
						type="button">
						<RadioDot $active={activeProviderMode === "openai"} />
						<OptionText>
							<OptionTitle>OpenAI Compatible</OptionTitle>
							<OptionHint>Use your own endpoint and API key</OptionHint>
						</OptionText>
					</OptionRow>
					<OptionRow
						$active={activeProviderMode === "talktollm"}
						aria-checked={activeProviderMode === "talktollm"}
						onClick={() => selectProviderMode("talktollm")}
						role="radio"
						type="button">
						<RadioDot $active={activeProviderMode === "talktollm"} />
						<OptionText>
							<OptionTitle>talktollm</OptionTitle>
							<OptionHint>Use at your own risk</OptionHint>
						</OptionText>
					</OptionRow>
					<OptionRow
						$active={activeProviderMode === "manual"}
						aria-checked={activeProviderMode === "manual"}
						onClick={() => selectProviderMode("manual")}
						role="radio"
						type="button">
						<RadioDot $active={activeProviderMode === "manual"} />
						<OptionText>
							<OptionTitle>Manual Mode</OptionTitle>
							<OptionHint>Copy prompts to any LLM chat & paste XML responses back</OptionHint>
						</OptionText>
					</OptionRow>
				</OptionList>
			</div>

			{isTalkToLlm ? (
				<div>
					<FieldLabel id="talktollm-model-label">AI Model</FieldLabel>
					<ChipGrid aria-labelledby="talktollm-model-label" role="radiogroup">
						{modelChoices.map((m) => (
							<Chip
								$active={m.active}
								aria-checked={m.active}
								key={m.id}
								onClick={() => selectTalkToLlmModel(m.id)}
								role="radio"
								type="button">
								{m.label}
							</Chip>
						))}
					</ChipGrid>

					{isAiStudioModel && (
						<div style={{ marginTop: 10 }}>
							<label
								htmlFor="aistudio-submodel-select"
								style={{
									display: "block",
									fontSize: 11,
									color: "var(--vscode-descriptionForeground)",
									marginBottom: 4,
								}}>
								AI Studio model
							</label>
							<StyledSelect
								id="aistudio-submodel-select"
								onChange={(e) => selectTalkToLlmModel(e.target.value)}
								value={activeAiStudioValue}>
								{AISTUDIO_SUBMODELS.map((sub) => (
									<option key={sub.value} value={sub.value}>
										{sub.label}
									</option>
								))}
							</StyledSelect>
						</div>
					)}
				</div>
			) : isManualMode ? (
				<ManualCard>
					<ManualHint>
						When a task runs, AMA Code compiles the full conversation prompt, opens the built-in{" "}
						<strong>Manual Mode</strong> panel inside VS Code, and lets you copy prompts and send back single or
						batched multi-tool XML responses with one click.
					</ManualHint>

					<VSCodeCheckbox
						checked={manualAutoCopy}
						onChange={async (e: any) => {
							await updateManualHeader(MANUAL_AUTOCOPY_HEADER, e.target.checked === true ? "true" : "false")
						}}>
						Auto-copy compiled prompt to clipboard
					</VSCodeCheckbox>

					<VSCodeCheckbox
						checked={manualIncludeUnifiedRules}
						onChange={async (e: any) => {
							await updateManualHeader(MANUAL_UNIFIED_RULES_HEADER, e.target.checked === true ? "true" : "false")
						}}>
						Append unified-rules.md multi-tool protocol
					</VSCodeCheckbox>

					<div>
						<VSCodeCheckbox
							checked={manualBrowserBridge}
							onChange={async (e: any) => {
								await updateManualHeader(MANUAL_BROWSER_BRIDGE_HEADER, e.target.checked === true ? "true" : "false")
							}}>
							Also run local browser control panel (HTTP)
						</VSCodeCheckbox>

						{manualBrowserBridge && (
							<PortRow>
								<label
									htmlFor="manual-bridge-port"
									style={{ fontSize: 11, color: "var(--vscode-descriptionForeground)" }}>
									Localhost port:
								</label>
								<PortInput
									id="manual-bridge-port"
									max={65535}
									min={1024}
									onChange={(e) => updateManualHeader(MANUAL_BRIDGE_PORT_HEADER, e.target.value)}
									type="number"
									value={manualBridgePort}
								/>
								<span style={{ fontSize: 11, color: "var(--vscode-descriptionForeground)" }}>
									http://127.0.0.1:{manualBridgePort || "4000"}
								</span>
							</PortRow>
						)}
					</div>
				</ManualCard>
			) : (
				<>
					{apiConfiguration && (
						<OpenAICompatibleProvider
							currentMode={currentMode}
							isPopup={isPopup}
							showModelOptions={showModelOptions}
						/>
					)}

					{apiErrorMessage && (
						<p
							style={{
								margin: "-10px 0 4px 0",
								fontSize: 12,
								color: "var(--vscode-errorForeground)",
							}}>
							{apiErrorMessage}
						</p>
					)}
					{modelIdErrorMessage && (
						<p
							style={{
								margin: "-10px 0 4px 0",
								fontSize: 12,
								color: "var(--vscode-errorForeground)",
							}}>
							{modelIdErrorMessage}
						</p>
					)}
				</>
			)}
		</div>
	)
}

export default ApiOptions