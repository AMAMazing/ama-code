import { ChildProcess, execSync, spawn } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"
import { ModelInfo, openAiModelInfoSaneDefaults } from "@shared/api"
import { HostProvider } from "@/hosts/host-provider"
import { ClineStorageMessage } from "@/shared/messages/content"
import { fetch } from "@/shared/net"
import { Logger } from "@/shared/services/Logger"
import { ApiHandler, CommonApiHandlerOptions } from "../index"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { ApiStream } from "../transform/stream"
import { UNIFIED_RULES_CONTENT } from "./unifiedRules"

export const TALKTOLM_BASE_URL_MARKER = "talktollm://local"
export const NTFY_TOPIC_HEADER = "x-clinex-ntfy-topic"
export const NTFY_LEVEL_HEADER = "x-clinex-ntfy-level"

export interface TalkToLlmHandlerOptions extends CommonApiHandlerOptions {
	modelId?: string
	headers?: Record<string, string>
}

export function normalizeTalkToLlmLineEndings(text: string): string {
	return text.replace(/\r+\n/g, "\n").replace(/\r/g, "\n")
}

const PYTHON_TALKTOLM_RUNNER = `
import sys
import os
import json
import time
import re
import base64
import io
import threading

if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", newline="\\n")
        sys.stderr.reconfigure(encoding="utf-8", newline="\\n")
        sys.stdin.reconfigure(encoding="utf-8")
    except Exception:
        pass

from talktollm import talkto

try:
    import optimisewait
except Exception:
    optimisewait = None

def set_clipboard_image(image_data):
    try:
        import win32clipboard
        from PIL import Image
        binary_data = base64.b64decode(image_data.split(",")[1])
        image = Image.open(io.BytesIO(binary_data))
        output = io.BytesIO()
        image.convert("RGB").save(output, "BMP")
        data = output.getvalue()[14:]
        output.close()
        win32clipboard.OpenClipboard()
        win32clipboard.EmptyClipboard()
        win32clipboard.SetClipboardData(win32clipboard.CF_DIB, data)
        win32clipboard.CloseClipboard()
        return True
    except Exception:
        return False

def get_content_text(content):
    if isinstance(content, str):
        return content
    elif isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                if item.get("type") == "text":
                    parts.append(item.get("text", ""))
                elif item.get("type") == "image_url":
                    image_data = item.get("image_url", {}).get("url", "")
                    if image_data.startswith("data:image"):
                        set_clipboard_image(image_data)
                    parts.append("[Image: An uploaded image]")
        return "\\n".join(parts)
    return ""

def main():
    raw_input = sys.stdin.read()
    if not raw_input.strip():
        sys.stderr.write("Empty request payload\\n")
        sys.exit(1)

    payload = json.loads(raw_input)
    model = (payload.get("model") or "gemini").lower()
    messages = payload.get("messages") or []
    ntfy_level = (payload.get("ntfy_level") or "none").lower()
    unified_rules = payload.get("unified_rules") or ""

    image_list = []
    for message in messages:
        content = message.get("content", [])
        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict) and item.get("type") == "image_url":
                    image_url = item.get("image_url", {}).get("url", "")
                    if image_url.startswith("data:image"):
                        image_list.append(image_url)

    last_content = messages[-1].get("content", "") if messages else ""
    prompt = get_content_text(last_content)

    current_time_str = time.strftime("%Y-%m-%d %H:%M:%S")
    request_json = {"model": model, "messages": messages}
    headers_log = f"{current_time_str} - INFO - Request data: {json.dumps(request_json)}"

    prompt_instructions = [headers_log]
    if ntfy_level == "all":
        prompt_instructions.append(
            "You MUST include a \`<summary>\` tag inside your \`<thinking>\` block for every tool call. "
            "This summary should be a very brief, user-friendly explanation of the action you are about to take. "
            "For example: \`<summary>Reading the project's configuration to check dependencies.</summary>\`."
        )

    prompt_instructions.append(prompt)
    if unified_rules:
        prompt_instructions.append(unified_rules)

    fullpromptbefore = "\\n".join(prompt_instructions)
    full_prompt = re.sub(r"data:image\\/png;base64,[A-Za-z0-9+\\/=]+", "", fullpromptbefore)

    response = talkto(
        model,
        full_prompt,
        image_list,
        debug=False,
        humanize=True,
        windmouse=True,
        fast_mode=False,
    )

    if not isinstance(response, str):
        response = str(response or "")

    response = re.sub(r"\\r+\\n", "\\n", response).replace("\\r", "\\n")

    sys.stdout.write("\\n<<<TALKTOLM_RESPONSE_START>>>\\n")
    sys.stdout.write(response)
    sys.stdout.write("\\n<<<TALKTOLM_RESPONSE_END>>>\\n")
    sys.stdout.flush()

if __name__ == "__main__":
    main()
`

export async function sendNtfyNotification(topic: string, title: string, content: string, tags = "tada"): Promise<void> {
	if (!topic || !topic.trim()) {
		return
	}
	const cleanTopic = topic.trim()
	const targetUrl = cleanTopic.startsWith("http") ? cleanTopic : `https://ntfy.sh/${cleanTopic}`
	try {
		await fetch(targetUrl, {
			method: "POST",
			body: content,
			headers: {
				Title: title,
				Priority: "high",
				Tags: tags,
			},
		})
	} catch (error) {
		Logger.error(`[AMA Code ntfy] Failed to send notification: ${error}`)
	}
}

export async function dispatchNtfyForResponse(
	responseText: string,
	headers?: Record<string, string>,
): Promise<void> {
	const topic = headers?.[NTFY_TOPIC_HEADER] || ""
	const level = (headers?.[NTFY_LEVEL_HEADER] || "none").toLowerCase()
	if (!topic || level === "none") {
		return
	}

	const hasCompletion = responseText.includes("<attempt_completion>")
	const summaryMatch = responseText.match(/<summary>([\s\S]*?)<\/summary>/)
	const summary = summaryMatch ? summaryMatch[1].trim() : undefined

	if (level === "all") {
		if (hasCompletion) {
			await sendNtfyNotification(topic, "AMA Code: Task Completion", summary || "Task completion submitted.", "tada")
		} else if (summary) {
			await sendNtfyNotification(topic, "[INFO] AMA Code: AI Response", summary, "robot_face")
		}
	} else if (level === "completion" && hasCompletion) {
		await sendNtfyNotification(topic, "AMA Code: Task Completion", summary || responseText.slice(0, 1000), "tada")
	}
}

export class TalkToLlmHandler implements ApiHandler {
	private options: TalkToLlmHandlerOptions
	private static activeProcesses = new Set<ChildProcess>()

	constructor(options: TalkToLlmHandlerOptions) {
		this.options = options
	}

	public static killActiveProcesses(): void {
		for (const proc of TalkToLlmHandler.activeProcesses) {
			TalkToLlmHandler.killProcessTree(proc)
		}
		TalkToLlmHandler.activeProcesses.clear()
	}

	private static killProcessTree(proc: ChildProcess | undefined): void {
		if (!proc || proc.killed || proc.pid === undefined) {
			return
		}
		try {
			if (process.platform === "win32") {
				execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: "ignore" })
			} else {
				try {
					process.kill(-proc.pid, "SIGKILL")
				} catch {
					proc.kill("SIGKILL")
				}
			}
		} catch {
			try {
				proc.kill("SIGKILL")
			} catch {
				// Ignore errors if process already exited
			}
		}
	}

	abort(): void {
		TalkToLlmHandler.killActiveProcesses()
	}

	private resolvePythonExecutable(): string {
		const baseDirs: string[] = [process.cwd()]
		try {
			if (HostProvider.isInitialized()) {
				baseDirs.unshift(HostProvider.get().extensionFsPath)
			}
		} catch {
			// Ignore if HostProvider is not initialized
		}

		for (const dir of baseDirs) {
			if (process.platform === "win32") {
				const venvWin = path.join(dir, ".venv", "Scripts", "python.exe")
				if (fs.existsSync(venvWin)) {
					return venvWin
				}
			} else {
				const venvUnix = path.join(dir, ".venv", "bin", "python")
				if (fs.existsSync(venvUnix)) {
					return venvUnix
				}
			}
		}
		return "python"
	}

	async *createMessage(systemPrompt: string, messages: ClineStorageMessage[]): ApiStream {
		TalkToLlmHandler.killActiveProcesses()

		const modelId = this.options.modelId || "gemini"
		const ntfyTopic = this.options.headers?.[NTFY_TOPIC_HEADER] || ""
		const ntfyLevel = (this.options.headers?.[NTFY_LEVEL_HEADER] || "none").toLowerCase()

		let effectiveSystemPrompt = systemPrompt
		if (ntfyLevel === "all") {
			effectiveSystemPrompt +=
				"\n\nYou MUST include a `<summary>` tag inside your `<thinking>` block for every tool call. This summary should be a very brief, user-friendly explanation of the action you are about to take. For example: `<summary>Reading the project's configuration to check dependencies.</summary>`."
		}

		const openAiMessages = [
			{ role: "system", content: effectiveSystemPrompt },
			...convertToOpenAiMessages(messages),
		]

		const pythonExe = this.resolvePythonExecutable()
		const payload = JSON.stringify({
			model: modelId,
			messages: openAiMessages,
			ntfy_topic: ntfyTopic,
			ntfy_level: ntfyLevel,
			unified_rules: UNIFIED_RULES_CONTENT,
		})

		let proc: ChildProcess | undefined
		try {
			const responseText = await new Promise<string>((resolve, reject) => {
				proc = spawn(pythonExe, ["-u", "-c", PYTHON_TALKTOLM_RUNNER], {
					stdio: ["pipe", "pipe", "pipe"],
					windowsHide: true,
				})

				TalkToLlmHandler.activeProcesses.add(proc)

				let stdoutBuf = ""
				let stderrBuf = ""

				proc.stdout?.on("data", (chunk: Buffer) => {
					stdoutBuf += chunk.toString("utf-8")
				})

				proc.stderr?.on("data", (chunk: Buffer) => {
					stderrBuf += chunk.toString("utf-8")
				})

				proc.on("error", (err) => {
					if (proc) {
						TalkToLlmHandler.activeProcesses.delete(proc)
					}
					reject(new Error(`Failed to launch talktollm Python process: ${err.message}`))
				})

				proc.on("close", (code, signal) => {
					if (proc) {
						TalkToLlmHandler.activeProcesses.delete(proc)
					}
					const startMarker = "<<<TALKTOLM_RESPONSE_START>>>"
					const endMarker = "<<<TALKTOLM_RESPONSE_END>>>"
					const startIdx = stdoutBuf.indexOf(startMarker)
					const endIdx = stdoutBuf.indexOf(endMarker)

					if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
						const extracted = normalizeTalkToLlmLineEndings(
							stdoutBuf.slice(startIdx + startMarker.length, endIdx),
						).trim()
						resolve(extracted)
						return
					}

					if (signal || code !== 0) {
						reject(
							new Error(
								stderrBuf.trim() ||
									`talktollm process terminated (code: ${code}, signal: ${signal || "none"})`,
							),
						)
						return
					}

					resolve(normalizeTalkToLlmLineEndings(stdoutBuf).trim())
				})

				proc.stdin?.write(payload, "utf-8")
				proc.stdin?.end()
			})

			const normalizedResponse = normalizeTalkToLlmLineEndings(responseText)
			await dispatchNtfyForResponse(normalizedResponse, this.options.headers)

			const lines = normalizedResponse.split(/(\n)/)
			for (const segment of lines) {
				if (segment) {
					yield {
						type: "text",
						text: segment,
					}
				}
			}

			yield {
				type: "usage",
				inputTokens: effectiveSystemPrompt.length,
				outputTokens: normalizedResponse.length,
			}
		} finally {
			if (proc && TalkToLlmHandler.activeProcesses.has(proc)) {
				TalkToLlmHandler.killProcessTree(proc)
				TalkToLlmHandler.activeProcesses.delete(proc)
			}
		}
	}

	getModel(): { id: string; info: ModelInfo } {
		return {
			id: this.options.modelId || "gemini",
			info: {
				...openAiModelInfoSaneDefaults,
				supportsImages: true,
			},
		}
	}
}