import * as core from '@actions/core'
import { Rollup, filterFailedWorkflowRuns, formatConclusion, rollupChecks } from './checks.js'
import { CheckConclusionState } from './generated/graphql-types.js'
import { getListChecksQuery } from './queries/listChecks.js'
import { getOctokit } from './github.js'

// https://api.github.com/apps/github-actions
const GITHUB_ACTIONS_APP_ID = 15368

type Inputs = {
  filterWorkflowEvents: string[]
  excludeWorkflowNames: string[]
  filterWorkflowNames: string[]
  failFast: boolean
  initialDelaySeconds: number
  periodSeconds: number
  pageSizeOfCheckSuites: number
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
  await writeWorkflowRunsSummary(rollup)
  core.setOutput('rollup-state', rollup.conclusion)
  core.info(`----`)
  core.info(formatConclusion(rollup.conclusion))
  core.info(`----`)
  writeWorkflowRunsLog(rollup)
  core.info(`----`)

  if (rollup.conclusion === CheckConclusionState.Failure) {
    const failedWorkflowRuns = filterFailedWorkflowRuns(rollup.workflowRuns)
    const failedWorkflowNames = failedWorkflowRuns.map((run) => run.workflowName)
    core.setOutput('failed-workflow-names', failedWorkflowNames.join('\n'))
    throw new Error(`Some workflow has failed. See ${inputs.selfWorkflowURL} for the summary.`)
  }
  core.info(`You can see the summary at ${inputs.selfWorkflowURL}`)
}

const poll = async (inputs: Inputs): Promise<Rollup> => {
  const octokit = getOctokit(inputs.token)
  for (;;) {
    const checks = await getListChecksQuery(octokit, {
      owner: inputs.owner,
      name: inputs.repo,
      oid: inputs.sha,
      appId: GITHUB_ACTIONS_APP_ID,
      firstCheckSuite: inputs.pageSizeOfCheckSuites,
    })
    const rollup = rollupChecks(checks, inputs)
    if (rollup.conclusion !== null) {
      return rollup
    }
    core.startGroup(`Current workflow runs`)
    writeWorkflowRunsLog(rollup)
    core.endGroup()
    core.info(`Waiting for period ${inputs.periodSeconds}s`)
    await sleep(inputs.periodSeconds * 1000)
  }
}

const writeWorkflowRunsLog = (rollup: Rollup) => {
  for (const run of rollup.workflowRuns) {
    core.info(`${run.status}: ${formatConclusion(run.conclusion)}: ${run.workflowName} (${run.event}): ${run.url}`)
  }
}

const writeWorkflowRunsSummary = async (rollup: Rollup) => {
  core.summary.addHeading(formatConclusion(rollup.conclusion))
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
