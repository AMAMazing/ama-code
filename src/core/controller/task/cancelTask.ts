import { Empty, EmptyRequest } from "@shared/proto/cline/common"
import { ManualModeHandler } from "@/core/api/providers/manual"
import { TalkToLlmHandler } from "@/core/api/providers/talktollm"
import { Controller } from ".."

/**
 * Cancel the currently running task, kill any running talktollm processes, and cancel any waiting manual mode prompt
 * @param controller The controller instance
 * @param _request The empty request
 * @returns Empty response
 */
export async function cancelTask(controller: Controller, _request: EmptyRequest): Promise<Empty> {
	TalkToLlmHandler.killActiveProcesses()
	ManualModeHandler.cancelPending("Task cancelled by user.")
	await controller.cancelTask()
	return Empty.create()
}
