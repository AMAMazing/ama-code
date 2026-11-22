import { VSCodeCheckbox, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { useState } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useExtensionState } from "@/context/ExtensionStateContext"
import PreferredLanguageSetting from "../PreferredLanguageSetting"
import Section from "../Section"
import { updateSetting } from "../utils/settingsHandlers"
import { useApiConfigurationHandlers } from "../utils/useApiConfigurationHandlers"

const NTFY_TOPIC_HEADER = "x-clinex-ntfy-topic"
const NTFY_LEVEL_HEADER = "x-clinex-ntfy-level"

function generateRandomTopic(): string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
	const randomValues = new Uint8Array(14)
	crypto.getRandomValues(randomValues)
	let code = ""
	for (let i = 0; i < randomValues.length; i++) {
		code += chars[randomValues[i] % chars.length]
	}
	return `clinex-${code}`
}

interface GeneralSettingsSectionProps {
	renderSectionHeader: (tabId: string) => JSX.Element | null
}

const GeneralSettingsSection = ({ renderSectionHeader }: GeneralSettingsSectionProps) => {
	const { telemetrySetting, remoteConfigSettings, apiConfiguration } = useExtensionState()
	const { handleFieldChange } = useApiConfigurationHandlers()
	const [copied, setCopied] = useState(false)

	const currentHeaders = apiConfiguration?.openAiHeaders || {}
	const ntfyTopic = currentHeaders[NTFY_TOPIC_HEADER] || ""
	const ntfyLevel = (currentHeaders[NTFY_LEVEL_HEADER] || "none").toLowerCase()

	const setNtfyLevel = async (level: "none" | "completion" | "all") => {
		await handleFieldChange("openAiHeaders", {
			...currentHeaders,
			[NTFY_LEVEL_HEADER]: level,
		})
	}

	const enableNtfyTopic = async () => {
		const newTopic = generateRandomTopic()
		await handleFieldChange("openAiHeaders", {
			...currentHeaders,
			[NTFY_TOPIC_HEADER]: newTopic,
			[NTFY_LEVEL_HEADER]: ntfyLevel === "none" ? "completion" : ntfyLevel,
		})
	}

	const copyTopic = () => {
		if (!ntfyTopic) {
			return
		}
		navigator.clipboard.writeText(ntfyTopic).then(() => {
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		})
	}

	return (
		<div>
			{renderSectionHeader("general")}
			<Section>
				<div style={{ marginBottom: 14 }}>
					<label style={{ display: "block", marginBottom: 4 }}>
						<span style={{ fontWeight: 500, fontSize: 12 }}>Push Notifications (ntfy)</span>
					</label>

					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
							gap: 4,
							padding: 3,
							backgroundColor: "var(--vscode-input-background)",
							border: "1px solid var(--vscode-dropdown-border)",
							borderRadius: 6,
							marginBottom: 8,
						}}>
						{(
							[
								{ id: "none", label: "Off" },
								{ id: "completion", label: "Done" },
								{ id: "all", label: "All" },
							] as const
						).map((item) => {
							const active = ntfyLevel === item.id
							return (
								<button
									key={item.id}
									onClick={() => setNtfyLevel(item.id)}
									style={{
										padding: "5px 8px",
										borderRadius: 4,
										border: "none",
										outline: "none",
										cursor: "pointer",
										fontSize: 11.5,
										fontWeight: 500,
										backgroundColor: active ? "var(--vscode-button-background)" : "transparent",
										color: active
											? "var(--vscode-button-foreground)"
											: "var(--vscode-descriptionForeground)",
										transition: "background-color 0.12s ease, color 0.12s ease",
									}}
									type="button">
									{item.label}
								</button>
							)
						})}
					</div>

					{!ntfyTopic ? (
						<div>
							<button
								onClick={enableNtfyTopic}
								style={{
									width: "100%",
									fontSize: 11.5,
									fontWeight: 500,
									padding: "5px 10px",
									borderRadius: 4,
									outline: "none",
									cursor: "pointer",
									backgroundColor: "var(--vscode-button-secondaryBackground)",
									color: "var(--vscode-button-secondaryForeground)",
									border: "1px solid var(--vscode-dropdown-border)",
								}}
								type="button">
								✨ Generate Topic Code
							</button>
						</div>
					) : (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								backgroundColor: "var(--vscode-input-background)",
								padding: "5px 8px",
								borderRadius: 4,
								border: "1px solid var(--vscode-dropdown-border)",
							}}>
							<code
								style={{
									fontSize: 11.5,
									color: "var(--vscode-textLink-foreground)",
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
								}}>
								{ntfyTopic}
							</code>
							<button
								onClick={copyTopic}
								style={{
									marginLeft: 8,
									padding: "2px 8px",
									borderRadius: 3,
									border: "none",
									outline: "none",
									cursor: "pointer",
									fontSize: 11,
									flexShrink: 0,
									backgroundColor: "var(--vscode-button-secondaryBackground)",
									color: "var(--vscode-button-secondaryForeground)",
								}}
								title="Copy Topic"
								type="button">
								{copied ? "✓ Copied" : "Copy"}
							</button>
						</div>
					)}
				</div>

				<PreferredLanguageSetting />

				<div className="mb-[5px]">
					<Tooltip>
						<TooltipContent hidden={remoteConfigSettings?.telemetrySetting === undefined}>
							This setting is managed by your organization's remote configuration
						</TooltipContent>
						<TooltipTrigger asChild>
							<div className="flex items-center gap-2 mb-[5px]">
								<VSCodeCheckbox
									checked={telemetrySetting !== "disabled"}
									disabled={remoteConfigSettings?.telemetrySetting === "disabled"}
									onChange={(e: any) => {
										const checked = e.target.checked === true
										updateSetting("telemetrySetting", checked ? "enabled" : "disabled")
									}}>
									Allow error and usage reporting
								</VSCodeCheckbox>
								{!!remoteConfigSettings?.telemetrySetting && (
									<i className="codicon codicon-lock text-description text-sm" />
								)}
							</div>
						</TooltipTrigger>
					</Tooltip>

					<p className="text-sm mt-[5px] text-description">
						Help improve Cline by sending usage data and error reports. No code, prompts, or personal information are
						ever sent. See our{" "}
						<VSCodeLink
							className="text-inherit"
							href="https://docs.cline.bot/more-info/telemetry"
							style={{ fontSize: "inherit", textDecoration: "underline" }}>
							telemetry overview
						</VSCodeLink>{" "}
						and{" "}
						<VSCodeLink
							className="text-inherit"
							href="https://cline.bot/privacy"
							style={{ fontSize: "inherit", textDecoration: "underline" }}>
							privacy policy
						</VSCodeLink>{" "}
						for more details.
					</p>
				</div>
			</Section>
		</div>
	)
}

export default GeneralSettingsSection