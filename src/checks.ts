import assert from 'assert'
import * as minimatch from 'minimatch'
import { ListChecksQuery } from './generated/graphql.js'
import { CheckConclusionState, CheckStatusState } from './generated/graphql-types.js'

export type Rollup = {
  status: RollupStatus
  conclusion: RollupConclusion
  workflowRuns: WorkflowRun[]
}

type RollupStatus = CheckStatusState.Completed | null

type RollupConclusion = CheckConclusionState.Success | CheckConclusionState.Failure | null

type WorkflowRun = {
  status: CheckStatusState
  conclusion: CheckConclusionState | null
  event: string
  url: string
  workflowName: string
}

export type RollupOptions = {
  selfWorkflowName: string
  filterWorkflowEvents: string[]
  excludeWorkflowNames: string[]
  filterWorkflowNames: string[]
}

export const rollupChecks = (checks: ListChecksQuery, options: RollupOptions): Rollup => {
  assert(checks.repository != null, `repository must not be null`)
  assert(checks.repository.object != null, `repository.object must not be null`)
  assert.strictEqual(checks.repository.object.__typename, 'Commit')
  assert(checks.repository.object.checkSuites != null, `repository.object.checkSuites must not be null`)
  assert(checks.repository.object.checkSuites.nodes != null, `repository.object.checkSuites.nodes must not be null`)

  const rawWorkflowRuns: WorkflowRun[] = []
  for (const node of checks.repository.object.checkSuites.nodes) {
    assert(node != null, `checkSuite.node must not be null`)
    assert(node.conclusion !== undefined, `checkSuite.node.conclusion must not be undefined`)
    if (node.workflowRun == null) {
      continue
    }
    rawWorkflowRuns.push({
      status: node.status,
      conclusion: node.conclusion,
      event: node.workflowRun.event,
      url: node.workflowRun.url,
      workflowName: node.workflowRun.workflow.name,
    })
  }

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
    status: determineRollupStatus(workflowRuns),
    conclusion: determineRollupConclusion(workflowRuns),
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

export const determineRollupConclusion = (workflowRuns: WorkflowRun[]): RollupConclusion => {
  if (workflowRuns.some((run) => isFailedConclusion(run.conclusion))) {
    return CheckConclusionState.Failure
  }
  if (workflowRuns.every((run) => run.status === CheckStatusState.Completed)) {
    return CheckConclusionState.Success
  }
  return null
}

export const determineRollupStatus = (workflowRuns: WorkflowRun[]): RollupStatus => {
  if (workflowRuns.every((run) => run.status === CheckStatusState.Completed)) {
    return CheckStatusState.Completed
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
