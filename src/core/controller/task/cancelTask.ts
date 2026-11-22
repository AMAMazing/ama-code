import { Empty, EmptyRequest } from "@shared/proto/cline/common"
import { TalkToLlmHandler } from "@/core/api/providers/talktollm"
import { Controller } from ".."

/**
 * Cancel the currently running task and completely kill any running talktollm processes
 * @param controller The controller instance
 * @param _request The empty request
 * @returns Empty response
 */
export async function cancelTask(controller: Controller, _request: EmptyRequest): Promise<Empty> {
	TalkToLlmHandler.killActiveProcesses()
	await controller.cancelTask()
	return Empty.create()
}
