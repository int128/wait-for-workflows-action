import * as core from '@actions/core'
import * as github from '@actions/github'
import * as actionsChecks from './queries/actionsChecks'
import { filterFailedWorkflowRuns, summarize } from './checks'
import { StatusState } from './generated/graphql-types'

// https://api.github.com/apps/github-actions
const GITHUB_ACTIONS_APP_ID = 15368

type Inputs = {
  initialDelaySeconds: number
  periodSeconds: number
  sha: string
  token: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  const octokit = github.getOctokit(inputs.token)

  // exclude self to prevent an infinite loop
  const selfWorkflowName = github.context.workflow
  const excludeWorkflowNames = [selfWorkflowName]
  core.info(`Excluding workflows: ${excludeWorkflowNames.join(', ')}`)

  core.info(`Waiting for initial delay ${inputs.initialDelaySeconds}s`)
  await sleep(inputs.initialDelaySeconds * 1000)

  for (;;) {
    const checks = await actionsChecks.paginate(actionsChecks.withOctokit(octokit), {
      owner: github.context.repo.owner,
      name: github.context.repo.repo,
      oid: inputs.sha,
      appId: GITHUB_ACTIONS_APP_ID,
    })

    const summary = summarize(checks, excludeWorkflowNames)
    core.startGroup(`State: ${summary.state}`)
    for (const run of summary.workflowRuns) {
      core.info(`${run.status}: ${run.conclusion}: ${run.workflowName} (${run.event})`)
    }
    core.endGroup()

    if (summary.state === StatusState.Success) {
      return
    }
    if (summary.state === StatusState.Failure) {
      const failedWorkflowNames = filterFailedWorkflowRuns(summary.workflowRuns).map((run) => run.workflowName)
      throw new Error(`Failed workflows: ${failedWorkflowNames.join(', ')}`)
    }

    core.info(`Waiting for period ${inputs.periodSeconds}s`)
    await sleep(inputs.periodSeconds * 1000)
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
