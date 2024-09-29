import * as core from '@actions/core'
import { Rollup, filterFailedWorkflowRuns, rollupChecks } from './checks.js'
import { StatusState } from './generated/graphql-types.js'
import { getListChecksQuery } from './queries/listChecks.js'
import { getOctokit } from './github.js'

// https://api.github.com/apps/github-actions
const GITHUB_ACTIONS_APP_ID = 15368

type Inputs = {
  initialDelaySeconds: number
  periodSeconds: number
  filterWorkflowEvents: string[]
  excludeWorkflowNames: string[]
  filterWorkflowNames: string[]
  sha: string
  owner: string
  repo: string
  selfWorkflowName: string
  token: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  core.info(`Target commit is ${inputs.sha}`)
  core.info(`Filtering workflows by event: ${inputs.filterWorkflowEvents.join(', ')}`)
  core.info(`Excluding workflow name: ${inputs.excludeWorkflowNames.join(', ')}`)

  core.info(`Waiting for initial delay ${inputs.initialDelaySeconds}s`)
  await sleep(inputs.initialDelaySeconds * 1000)

  const rollup = await poll(inputs)
  core.setOutput('rollup-state', rollup.state)
  if (rollup.state === StatusState.Failure) {
    const failedWorkflowRuns = filterFailedWorkflowRuns(rollup.workflowRuns)
    const failedWorkflowNames = failedWorkflowRuns.map((run) => run.workflowName)
    core.setOutput('failed-workflow-names', failedWorkflowNames.join('\n'))
    throw new Error(`Failed workflows: ${failedWorkflowNames.join(', ')}`)
  }
}

const poll = async (inputs: Inputs): Promise<Rollup> => {
  const octokit = getOctokit(inputs.token)
  for (;;) {
    const checks = await getListChecksQuery(octokit, {
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

    if (rollup.state === StatusState.Success || rollup.state === StatusState.Failure) {
      return rollup
    }
    core.info(`Waiting for period ${inputs.periodSeconds}s`)
    await sleep(inputs.periodSeconds * 1000)
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
