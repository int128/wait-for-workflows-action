import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as core from '@actions/core'
import * as yaml from 'js-yaml'
import { z } from 'zod'
import type { Context } from './github.js'

const Workflow = z.object({
  on: z.union([
    z.record(
      z.string(),
      z.union([
        z.null(),
        z.array(z.any()),
        z.object({
          types: z.array(z.string()).optional(),
        }),
      ]),
    ),
    z.array(z.string()),
    z.string(),
  ]),
})

type Workflow = z.infer<typeof Workflow>

type WorkflowFile = {
  path: string
  workflow: Workflow
}

const parseWorkflowFiles = async function* (cwd: string): AsyncGenerator<WorkflowFile> {
  for await (const workflowFile of fs.glob(['.github/workflows/*.{yaml,yml}'], { cwd })) {
    const content = await fs.readFile(path.join(cwd, workflowFile), 'utf-8')
    try {
      yield {
        path: workflowFile,
        workflow: Workflow.parse(yaml.load(content, { schema: yaml.CORE_SCHEMA })),
      }
    } catch (error) {
      throw new Error(`Invalid workflow: ${workflowFile}: ${error}`)
    }
  }
}

const getTrigger = (workflowFile: WorkflowFile, eventName: string) => {
  if (typeof workflowFile.workflow.on === 'string') {
    if (workflowFile.workflow.on === eventName) {
      return null
    }
    return undefined
  }
  if (Array.isArray(workflowFile.workflow.on)) {
    if (workflowFile.workflow.on.includes(eventName)) {
      return null
    }
    return undefined
  }
  const trigger = workflowFile.workflow.on[eventName]
  if (Array.isArray(trigger)) {
    return null
  }
  return trigger
}

const getActivityTypes = (workflowFile: WorkflowFile, eventName: string): string[] | null | undefined => {
  const trigger = getTrigger(workflowFile, eventName)
  if (trigger === undefined) {
    return undefined
  }
  if (eventName === 'pull_request' || eventName === 'pull_request_target') {
    // https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request
    // https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target
    return trigger?.types ?? ['opened', 'synchronize', 'reopened']
  }
  // If types is not specified in the trigger, it matches all activity types.
  return trigger?.types ?? null
}

export const getWorkflowFilePathsForCurrentActivityType = async (context: Context): Promise<string[]> => {
  const workflowFiles = await Array.fromAsync(parseWorkflowFiles(context.workspace))
  if (workflowFiles.length === 0) {
    // It should contain the workflow file calling this action.
    throw new Error(
      `No workflow file found. You need to checkout the repository to enable filter-by-current-activity-type option.`,
    )
  }

  const workflowFilePaths: string[] = []
  for (const workflowFile of workflowFiles) {
    const activityTypes = getActivityTypes(workflowFile, context.eventName)
    if (activityTypes === undefined) {
      continue
    }
    core.info(`Workflow ${workflowFile.path}: ${activityTypes}`)
    if (activityTypes === null || !('action' in context.payload)) {
      // If types is not specified, it matches all activity types.
      workflowFilePaths.push(workflowFile.path)
    } else if (activityTypes.includes(context.payload.action)) {
      workflowFilePaths.push(workflowFile.path)
    }
  }
  return workflowFilePaths
}
