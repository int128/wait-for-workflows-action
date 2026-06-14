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
      z
        .union([
          z.array(z.any()),
          z.object({
            types: z.array(z.string()).optional(),
          }),
        ])
        .nullable()
        .optional(),
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

type ActivityTypeFilter = string[] | 'all' | null

const getDefaultActivityTypeFilter = (eventName: string): ActivityTypeFilter => {
  if (eventName === 'pull_request' || eventName === 'pull_request_target') {
    // https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request
    // https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target
    return ['opened', 'synchronize', 'reopened']
  }
  // If the types are not specified in the trigger, it means all types.
  return 'all'
}

const findActivityTypeFilter = (workflowFile: WorkflowFile, eventName: string): ActivityTypeFilter => {
  if (typeof workflowFile.workflow.on === 'string') {
    if (workflowFile.workflow.on === eventName) {
      return getDefaultActivityTypeFilter(eventName)
    }
    return null
  } else if (Array.isArray(workflowFile.workflow.on)) {
    if (workflowFile.workflow.on.includes(eventName)) {
      return getDefaultActivityTypeFilter(eventName)
    }
    return null
  }

  const trigger = workflowFile.workflow.on[eventName]
  if (trigger === undefined) {
    return null
  } else if (trigger === null) {
    return getDefaultActivityTypeFilter(eventName)
  } else if (Array.isArray(trigger)) {
    return getDefaultActivityTypeFilter(eventName)
  } else if (trigger.types === undefined) {
    return getDefaultActivityTypeFilter(eventName)
  }
  return trigger.types
}

const matchActivityType = (workflowFile: WorkflowFile, eventName: string, action: string) => {
  const activityTypeFilter = findActivityTypeFilter(workflowFile, eventName)
  if (activityTypeFilter === null) {
    core.info(`[-] ${workflowFile.path}: no trigger for event ${eventName}`)
    return false
  } else if (activityTypeFilter === 'all') {
    core.info(`[o] ${workflowFile.path}: all types`)
    return true
  } else if (activityTypeFilter.includes(action)) {
    core.info(`[o] ${workflowFile.path}: matched types [${activityTypeFilter.join(', ')}]`)
    return true
  }
  core.info(`[x] ${workflowFile.path}: not matched types [${activityTypeFilter.join(', ')}]`)
  return false
}

export const getWorkflowFilePathsForCurrentActivityType = async (context: Context): Promise<string[]> => {
  const workflowFiles = await Array.fromAsync(parseWorkflowFiles(context.workspace))
  if (workflowFiles.length === 0) {
    // It should contain the workflow file calling this action.
    throw new Error(
      `No workflow file found. You need to checkout the repository to enable filter-by-current-activity-type option.`,
    )
  }
  const action = 'action' in context.payload ? context.payload.action : ''
  core.startGroup(`Finding workflow files for event ${context.eventName} and action ${action}`)
  const workflowFilesForActivityType = workflowFiles.filter((workflowFile) =>
    matchActivityType(workflowFile, context.eventName, action),
  )
  core.endGroup()
  return workflowFilesForActivityType.map((workflowFile) => workflowFile.path)
}
