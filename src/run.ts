import * as core from '@actions/core'
import { Rollup, filterFailedWorkflowRuns, rollupChecks } from './checks.js'
import { CheckConclusionState, StatusState } from './generated/graphql-types.js'
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
  selfWorkflowURL: string
  token: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  core.info(`Target commit: ${inputs.sha}`)
  core.info(`Filtering workflows by event: ${inputs.filterWorkflowEvents.join(', ')}`)
  core.info(`Excluding workflow name: ${inputs.excludeWorkflowNames.join(', ')}`)
  core.info(`Waiting for initial delay ${inputs.initialDelaySeconds}s`)
  await sleep(inputs.initialDelaySeconds * 1000)

  const rollup = await poll(inputs)
  core.setOutput('rollup-state', rollup.state)
  await writeWorkflowRunsSummary(rollup)
  core.info(`The workflows summary is available at ${inputs.selfWorkflowURL}`)

  if (rollup.state === StatusState.Failure) {
    const failedWorkflowRuns = filterFailedWorkflowRuns(rollup.workflowRuns)
    const failedWorkflowNames = failedWorkflowRuns.map((run) => run.workflowName)
    core.setOutput('failed-workflow-names', failedWorkflowNames.join('\n'))
    throw new Error(`Some workflow has failed. See ${inputs.selfWorkflowURL} for details.`)
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
    core.startGroup(`Workflows: ${rollup.state}`)
    writeWorkflowRunsLog(rollup)
    core.endGroup()

    if (rollup.state === StatusState.Success || rollup.state === StatusState.Failure) {
      return rollup
    }
    core.info(`Waiting for period ${inputs.periodSeconds}s`)
    await sleep(inputs.periodSeconds * 1000)
  }
}

const writeWorkflowRunsLog = (rollup: Rollup) => {
  for (const run of rollup.workflowRuns) {
    core.info(`${run.status}: ${run.conclusion}: ${run.workflowName} (${run.event}): ${run.url}`)
  }
}

const writeWorkflowRunsSummary = async (rollup: Rollup) => {
  core.summary.addHeading(`Workflows: ${rollup.state}`)
  core.summary.addTable([
    [
      { data: 'Workflow name', header: true },
      { data: 'URL', header: true },
      { data: 'Status', header: true },
      { data: 'Conclusion', header: true },
    ],
    ...rollup.workflowRuns.map((run) => [
      { data: `${run.workflowName} (${run.event})` },
      { data: `<a href="${run.url}">${run.url}</a>` },
      { data: run.status },
      { data: formatConclusion(run.conclusion) },
    ]),
  ])
  await core.summary.write()
}

const formatConclusion = (conclusion: CheckConclusionState | null): string => {
  switch (conclusion) {
    case CheckConclusionState.Failure:
      return `:x: ${conclusion}`
    case CheckConclusionState.Success:
      return `:white_check_mark ${conclusion}`
    case null:
      return ''
  }
  return conclusion
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
