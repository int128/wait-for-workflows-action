import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as core from '@actions/core'
import * as yaml from 'js-yaml'
import { z } from 'zod'
import type { Context } from './github.js'

const Workflow = z.object({
  on: z.record(
    z.string(),
    z
      .object({
        types: z.array(z.string()).optional(),
      })
      .nullable()
      .optional(),
  ),
})

type Workflow = z.infer<typeof Workflow>

type WorkflowFile = {
  path: string
  workflow: Workflow
}

const parseWorkflowFiles = async function* (cwd: string): AsyncGenerator<WorkflowFile> {
  for await (const workflowFile of fs.glob(['.github/workflows/*.yaml', '.github/workflows/*.yml'], { cwd })) {
    const content = await fs.readFile(path.join(cwd, workflowFile), 'utf-8')
    try {
      yield {
        path: workflowFile,
        workflow: Workflow.parse(yaml.load(content)),
      }
      core.info(`Parsed ${workflowFile}`)
    } catch (error) {
      core.warning(`Failed to parse ${workflowFile}: ${error}`)
    }
  }
}

const filterByCurrentActivityType = (workflowFile: WorkflowFile, context: Context) => {
  const eventCondition = workflowFile.workflow.on[context.eventName]
  if (eventCondition === undefined) {
    return false
  }
  if (context.eventName === 'pull_request' && 'action' in context.payload) {
    // https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request
    const possibleActivityTypes = eventCondition?.types ?? ['opened', 'synchronize', 'reopened']
    return possibleActivityTypes.includes(context.payload.action)
  }
  if (context.eventName === 'pull_request_target' && 'action' in context.payload) {
    // https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target
    const possibleActivityTypes = eventCondition?.types ?? ['opened', 'synchronize', 'reopened']
    return possibleActivityTypes.includes(context.payload.action)
  }
  if (eventCondition?.types !== undefined && 'action' in context.payload) {
    return eventCondition.types.includes(context.payload.action)
  }
  return true
}

export const getWorkflowFilePathsForCurrentActivityType = async (context: Context): Promise<string[]> => {
  const workflowFiles = await Array.fromAsync(parseWorkflowFiles(context.workspace))
  if (workflowFiles.length === 0) {
    throw new Error(
      `No workflow file found. You need to checkout the repository to enable filter-by-current-activity-type option.`,
    )
  }
  return workflowFiles
    .filter((workflowFile) => filterByCurrentActivityType(workflowFile, context))
    .map((workflowFile) => workflowFile.path)
}
