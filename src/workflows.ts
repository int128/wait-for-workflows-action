import * as fs from 'node:fs/promises'
import * as core from '@actions/core'
import * as yaml from 'js-yaml'
import { z } from 'zod'
import type { Context } from './github.js'

const Workflow = z.object({
  on: z.object({
    pull_request: z
      .object({
        types: z.array(z.string()).optional(),
      })
      .nullable()
      .optional(),
  }),
})

type Workflow = z.infer<typeof Workflow>

type WorkflowFile = {
  path: string
  workflow: Workflow
}

const parseWorkflowFiles = async function* (cwd: string): AsyncGenerator<WorkflowFile> {
  for await (const workflowFile of fs.glob(['.github/workflows/*.yaml', '.github/workflows/*.yml'], { cwd })) {
    const content = await fs.readFile(workflowFile, 'utf-8')
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

const getWorkflowFilePathsForPullRequestActivityType = async function* (activityType: string, workspace: string) {
  for await (const workflowFile of parseWorkflowFiles(workspace)) {
    if (workflowFile.workflow.on.pull_request !== undefined) {
      // https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request
      const workflowActivityTypes = workflowFile.workflow.on.pull_request?.types ?? ['opened', 'synchronize', 'reopened']
      if (workflowActivityTypes.includes(activityType)) {
        yield workflowFile.path
      }
    }
  }
}

export const getWorkflowFilePathsForCurrentActivityType = async (context: Context): Promise<string[]> => {
  if (context.eventName === 'pull_request' && 'action' in context.payload) {
    return Array.fromAsync(getWorkflowFilePathsForPullRequestActivityType(context.payload.action, context.workspace))
  }
  return []
}
