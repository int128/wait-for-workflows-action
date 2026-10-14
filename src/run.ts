import * as core from '@actions/core'
import type { Octokit } from '@octokit/action'
import { getAnnotatedWorkflowRuns } from './annotations.js'
import { CheckConclusionState, CheckStatusState } from './generated/graphql-types.js'
import type { Context } from './github.js'
import { executeWorkflowRunAnnotationsQuery } from './queries/workflowRunAnnotations.js'
import { executeWorkflowRunsForCommitQuery } from './queries/workflowRunsForCommit.js'
import { writeWorkflowRunsSummary } from './summary.js'
import {
  filterCompletedWorkflowRuns,
  formatConclusion,
  formatStatus,
  isFailedConclusion,
  type Rollup,
  rollupWorkflowRuns,
  type WorkflowRun,
} from './workflowRuns.js'
import { getWorkflowFilePathsForCurrentActivityType } from './workflows.js'

// https://api.github.com/apps/github-actions
const GITHUB_ACTIONS_APP_ID = 15368

type Inputs = {
  failFast: boolean
  initialDelaySeconds: number
  periodSeconds: number
  pageSizeOfCheckSuites: number
  sha: string
  selfWorkflowURL: string
  selfWorkflowName: string
  filterWorkflowEvents: string[]
  excludeWorkflowNames: string[]
  filterWorkflowNames: string[]
  filterByCurrentActivityType: boolean
}

type Outputs = {
  rollupState: string | null
  failedWorkflowNames: string[]
  failedWorkflowAnnotations: string[]
}

export const run = async (inputs: Inputs, octokit: Octokit, context: Context): Promise<Outputs> => {
  core.info(`Target commit: ${inputs.sha}`)
  core.info(`Filtering workflows by event: ${inputs.filterWorkflowEvents.join(', ')}`)
  core.info(`Excluding workflow name: ${inputs.excludeWorkflowNames.join(', ')}`)

  const rollup = await poll(inputs, octokit, context)
  const failedWorkflowRuns = rollup.workflowRuns.filter((run) => isFailedConclusion(run.conclusion))
  const annotatedWorkflowRuns = await fetchAnnotatedWorkflowRuns(failedWorkflowRuns, octokit)

  core.info(`----`)
  core.info(formatConclusion(rollup.conclusion))
  core.info(`----`)
  core.info(`For details, see ${inputs.selfWorkflowURL}`)
  core.info(`----`)
  await writeWorkflowRunsSummary(rollup, annotatedWorkflowRuns)
  if (rollup.conclusion === CheckConclusionState.Failure) {
    core.setFailed(`Some workflow has failed. For details, see ${inputs.selfWorkflowURL}`)
  }
  return {
    rollupState: rollup.conclusion,
    failedWorkflowNames: failedWorkflowRuns.map((run) => run.workflowName),
    failedWorkflowAnnotations: [
      ...new Set(annotatedWorkflowRuns.flatMap((workflowRun) => workflowRun.failureAnnotationMessages)),
    ],
  }
}

const poll = async (inputs: Inputs, octokit: Octokit, context: Context): Promise<Rollup> => {
  let workflowFilePathsForCurrentActivityType: string[] = []
  if (inputs.filterByCurrentActivityType) {
    workflowFilePathsForCurrentActivityType = await getWorkflowFilePathsForCurrentActivityType(context)
  }

  core.info(`Waiting for initial delay ${inputs.initialDelaySeconds}s`)
  await sleep(inputs.initialDelaySeconds * 1000)
  for (;;) {
    core.startGroup(`query workflowRunsForCommit(${inputs.sha})`)
    const workflowRunsForCommitQuery = await executeWorkflowRunsForCommitQuery(octokit, {
      owner: context.repo.owner,
      name: context.repo.repo,
      oid: inputs.sha,
      appId: GITHUB_ACTIONS_APP_ID,
      firstCheckSuite: inputs.pageSizeOfCheckSuites,
    })
    core.endGroup()

    const rollup = rollupWorkflowRuns(workflowRunsForCommitQuery, {
      selfWorkflowName: inputs.selfWorkflowName,
      filterWorkflowEvents: inputs.filterWorkflowEvents,
      excludeWorkflowNames: inputs.excludeWorkflowNames,
      filterWorkflowNames: inputs.filterWorkflowNames,
      filterWorkflowFilePaths: workflowFilePathsForCurrentActivityType,
    })
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

const fetchAnnotatedWorkflowRuns = async (failedWorkflowRuns: WorkflowRun[], octokit: Octokit) => {
  if (failedWorkflowRuns.length === 0) {
    return []
  }
  const FETCH_LIMIT = 100
  const workflowRunIds = failedWorkflowRuns.slice(0, FETCH_LIMIT).map((run) => run.id)
  core.startGroup(`query workflowRunAnnotations`)
  const query = await executeWorkflowRunAnnotationsQuery(octokit, workflowRunIds)
  core.endGroup()
  return getAnnotatedWorkflowRuns(query)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
