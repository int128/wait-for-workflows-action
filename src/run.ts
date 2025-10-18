import * as core from '@actions/core'
import type { Octokit } from '@octokit/action'
import {
  filterCompletedWorkflowRuns,
  filterFailedWorkflowRuns,
  formatConclusion,
  formatStatus,
  type Rollup,
  type RollupOptions,
  rollupChecks,
} from './checks.js'
import { CheckConclusionState, CheckStatusState } from './generated/graphql-types.js'
import type { Context } from './github.js'
import { getListChecksQuery } from './queries/listChecks.js'

// https://api.github.com/apps/github-actions
const GITHUB_ACTIONS_APP_ID = 15368

type Inputs = {
  failFast: boolean
  initialDelaySeconds: number
  periodSeconds: number
  pageSizeOfCheckSuites: number
  sha: string
  selfWorkflowURL: string
} & RollupOptions

type Outputs = {
  rollupState: string | null
  failedWorkflowNames: string[]
}

export const run = async (inputs: Inputs, octokit: Octokit, context: Context): Promise<Outputs> => {
  core.info(`Target commit: ${inputs.sha}`)
  core.info(`Filtering workflows by event: ${inputs.filterWorkflowEvents.join(', ')}`)
  core.info(`Excluding workflow name: ${inputs.excludeWorkflowNames.join(', ')}`)
  core.info(`Waiting for initial delay ${inputs.initialDelaySeconds}s`)
  await sleep(inputs.initialDelaySeconds * 1000)

  const rollup = await poll(inputs, octokit, context)
  core.info(`----`)
  core.info(formatConclusion(rollup.conclusion))
  core.info(`----`)
  await writeWorkflowRunsSummary(rollup)
  core.info(`For details, see ${inputs.selfWorkflowURL}`)
  core.info(`----`)

  if (rollup.conclusion === CheckConclusionState.Failure) {
    core.setFailed(`Some workflow has failed. For details, see ${inputs.selfWorkflowURL}`)
  }
  return {
    rollupState: rollup.conclusion,
    failedWorkflowNames: filterFailedWorkflowRuns(rollup.workflowRuns).map((run) => run.workflowName),
  }
}

const poll = async (inputs: Inputs, octokit: Octokit, context: Context): Promise<Rollup> => {
  for (;;) {
    core.startGroup(`GraphQL request`)
    const checks = await getListChecksQuery(octokit, {
      owner: context.repo.owner,
      name: context.repo.repo,
      oid: inputs.sha,
      appId: GITHUB_ACTIONS_APP_ID,
      firstCheckSuite: inputs.pageSizeOfCheckSuites,
    })
    core.endGroup()

    const rollup = rollupChecks(checks, inputs)
    const completedCount = filterCompletedWorkflowRuns(rollup.workflowRuns).length
    core.startGroup(`Current workflow runs: ${completedCount} / ${rollup.workflowRuns.length} completed`)
    writeWorkflowRunsLog(rollup)
    core.endGroup()

    if (rollup.status === CheckStatusState.Completed) {
      return rollup
    }
    if (inputs.failFast && rollup.conclusion === CheckConclusionState.Failure) {
      return rollup
    }
    core.info(`Waiting for ${inputs.periodSeconds}s`)
    await sleep(inputs.periodSeconds * 1000)
  }
}

const writeWorkflowRunsLog = (rollup: Rollup) => {
  for (const run of rollup.workflowRuns) {
    const columns = [
      formatStatus(run.status),
      formatConclusion(run.conclusion),
      `${run.workflowName} (${run.event})`,
      run.url,
    ]
    core.info(columns.join(': '))
  }
}

const writeWorkflowRunsSummary = async (rollup: Rollup) => {
  core.summary.addHeading('wait-for-workflows summary', 2)
  core.summary.addRaw('<p>Rollup conclusion: ')
  core.summary.addRaw(formatConclusion(rollup.conclusion))
  core.summary.addRaw('</p>')
  core.summary.addTable([
    [
      { data: 'Workflow run', header: true },
      { data: 'Status', header: true },
      { data: 'Conclusion', header: true },
    ],
    ...rollup.workflowRuns.map((run) => [
      { data: `<a href="${run.url}">${run.workflowName} (${run.event})</a>` },
      { data: formatStatus(run.status) },
      { data: formatConclusion(run.conclusion) },
    ]),
  ])
  await core.summary.write()
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
