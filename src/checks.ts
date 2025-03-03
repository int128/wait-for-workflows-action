import assert from 'assert'
import * as minimatch from 'minimatch'
import { ListChecksQuery } from './generated/graphql.js'
import { CheckConclusionState, CheckStatusState } from './generated/graphql-types.js'

export type Rollup = {
  conclusion: RollupConclusion
  workflowRuns: WorkflowRun[]
}

type RollupConclusion = CheckConclusionState.Success | CheckConclusionState.Failure | null

type WorkflowRun = {
  status: CheckStatusState
  conclusion: CheckConclusionState | null
  event: string
  url: string
  workflowName: string
}

export type RollupOptions = {
  failFast: boolean
  selfWorkflowName: string
  filterWorkflowEvents: string[]
  excludeWorkflowNames: string[]
  filterWorkflowNames: string[]
}

export const rollupChecks = (checks: ListChecksQuery, options: RollupOptions): Rollup => {
  assert(checks.repository != null)
  assert(checks.repository.object != null)
  assert.strictEqual(checks.repository.object.__typename, 'Commit')
  assert(checks.repository.object.checkSuites != null)
  assert(checks.repository.object.checkSuites.nodes != null)
  const rawWorkflowRuns = checks.repository.object.checkSuites.nodes.map<WorkflowRun>((node) => {
    assert(node != null)
    assert(node.conclusion !== undefined)
    assert(node.workflowRun != null)
    return {
      status: node.status,
      conclusion: node.conclusion,
      event: node.workflowRun.event,
      url: node.workflowRun.url,
      workflowName: node.workflowRun.workflow.name,
    }
  })

  const excludeWorkflowNameMatchers = options.excludeWorkflowNames.map((pattern) => minimatch.filter(pattern))
  const filterWorkflowNameMatchers = options.filterWorkflowNames.map((pattern) => minimatch.filter(pattern))
  const workflowRuns = rawWorkflowRuns.filter((workflowRun) => {
    // Exclude self to prevent the infinite loop
    if (workflowRun.workflowName === options.selfWorkflowName) {
      return false
    }
    // Filter workflows by event
    if (options.filterWorkflowEvents.length > 0) {
      if (!options.filterWorkflowEvents.includes(workflowRun.event)) {
        return false
      }
    }
    // Exclude workflows by names
    if (excludeWorkflowNameMatchers.length > 0) {
      if (excludeWorkflowNameMatchers.some((match) => match(workflowRun.workflowName))) {
        return false
      }
    }
    // Filter workflows by names
    if (filterWorkflowNameMatchers.length > 0) {
      if (!filterWorkflowNameMatchers.some((match) => match(workflowRun.workflowName))) {
        return false
      }
    }
    return true
  })

  sortByWorkflowName(workflowRuns)

  return {
    conclusion: rollupConclusion(workflowRuns, options),
    workflowRuns,
  }
}

const sortByWorkflowName = (workflowRuns: WorkflowRun[]) =>
  workflowRuns.sort((a, b) => a.workflowName.localeCompare(b.workflowName))

const isFailedConclusion = (conclusion: CheckConclusionState | null): boolean =>
  conclusion === CheckConclusionState.Failure ||
  conclusion === CheckConclusionState.Cancelled ||
  conclusion === CheckConclusionState.StartupFailure ||
  conclusion === CheckConclusionState.TimedOut

export const rollupConclusion = (workflowRuns: WorkflowRun[], options: { failFast: boolean }): RollupConclusion => {
  if (workflowRuns.every((run) => run.status === CheckStatusState.Completed)) {
    if (workflowRuns.some((run) => isFailedConclusion(run.conclusion))) {
      return CheckConclusionState.Failure
    }
    return CheckConclusionState.Success
  }
  if (options.failFast) {
    if (workflowRuns.some((run) => isFailedConclusion(run.conclusion))) {
      return CheckConclusionState.Failure
    }
  }
  return null
}

export const formatConclusion = (conclusion: CheckConclusionState | null): string => {
  if (isFailedConclusion(conclusion)) {
    return `❌ ${conclusion}`
  }
  if (conclusion === CheckConclusionState.Success) {
    return `✅ ${conclusion}`
  }
  return conclusion ?? ''
}

export const formatStatus = (status: CheckStatusState): string => {
  switch (status) {
    case CheckStatusState.Queued:
      return `🕒 ${status}`
    case CheckStatusState.InProgress:
      return `🚧 ${status}`
  }
  return status
}

export const filterFailedWorkflowRuns = (workflowRuns: WorkflowRun[]): WorkflowRun[] =>
  workflowRuns.filter((run) => isFailedConclusion(run.conclusion))

export const filterCompletedWorkflowRuns = (workflowRuns: WorkflowRun[]): WorkflowRun[] =>
  workflowRuns.filter((run) => run.status === CheckStatusState.Completed)
