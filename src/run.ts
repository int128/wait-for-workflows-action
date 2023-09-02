import * as core from '@actions/core'
import * as github from '@actions/github'
import * as listChecks from './queries/listChecks'
import { filterFailedWorkflowRuns, rollupChecks } from './checks'
import { StatusState } from './generated/graphql-types'

// https://api.github.com/apps/github-actions
const GITHUB_ACTIONS_APP_ID = 15368

type Inputs = {
  initialDelaySeconds: number
  periodSeconds: number
  excludeWorkflowNames: string[]
  sha: string
  owner: string
  repo: string
  selfWorkflowName: string
  token: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  const octokit = github.getOctokit(inputs.token)

  core.info(`Waiting for initial delay ${inputs.initialDelaySeconds}s`)
  await sleep(inputs.initialDelaySeconds * 1000)

  for (;;) {
    const checks = await listChecks.paginate(listChecks.withOctokit(octokit), {
      owner: inputs.owner,
      name: inputs.repo,
      oid: inputs.sha,
      appId: GITHUB_ACTIONS_APP_ID,
    })

    const rollup = rollupChecks(checks, inputs)
    core.startGroup(`Rollup state: ${rollup.state}`)
    for (const run of rollup.workflowRuns) {
      core.info(`${run.status}: ${run.conclusion}: ${run.workflowName} (${run.event})`)
    }
    core.endGroup()

    if (rollup.state === StatusState.Success) {
      return
    }
    if (rollup.state === StatusState.Failure) {
      const failedWorkflowNames = filterFailedWorkflowRuns(rollup.workflowRuns).map((run) => run.workflowName)
      throw new Error(`Failed workflows: ${failedWorkflowNames.join(', ')}`)
    }

    core.info(`Waiting for period ${inputs.periodSeconds}s`)
    await sleep(inputs.periodSeconds * 1000)
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
