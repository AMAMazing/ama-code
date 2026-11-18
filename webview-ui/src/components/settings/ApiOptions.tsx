import { Mode } from "@shared/storage/types"
import { useEffect } from "react"
import styled from "styled-components"
import { normalizeApiConfiguration } from "@/components/settings/utils/providerUtils"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { OPENROUTER_MODEL_PICKER_Z_INDEX } from "./OpenRouterModelPicker"
import { OpenAICompatibleProvider } from "./providers/OpenAICompatible"
import { useApiConfigurationHandlers } from "./utils/useApiConfigurationHandlers"

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
	const { handleModeFieldChange } = useApiConfigurationHandlers()

	useEffect(() => {
		if (selectedProvider !== "openai") {
			handleModeFieldChange({ plan: "planModeApiProvider", act: "actModeApiProvider" }, "openai", currentMode)
		}
	}, [selectedProvider, currentMode, handleModeFieldChange])

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: isPopup ? -10 : 0 }}>
			<DropdownContainer className="dropdown-container">
				<label htmlFor="api-provider">
					<span style={{ fontWeight: 500 }}>API Provider</span>
				</label>
				<div
					data-testid="provider-selector-input"
					id="api-provider"
					style={{
						padding: "6px 8px",
						backgroundColor: "var(--vscode-dropdown-background)",
						color: "var(--vscode-dropdown-foreground)",
						border: "1px solid var(--vscode-dropdown-border)",
						borderRadius: 2,
						fontSize: 13,
					}}>
					OpenAI Compatible
				</div>
			</DropdownContainer>

			{apiConfiguration && (
				<OpenAICompatibleProvider currentMode={currentMode} isPopup={isPopup} showModelOptions={showModelOptions} />
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
		</div>
	)
}

export default ApiOptions