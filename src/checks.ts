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

type RollupOptions = {
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

  return {
    conclusion: rollupWorkflowRuns(workflowRuns),
    workflowRuns,
  }
}

const isFailedConclusion = (conclusion: CheckConclusionState | null): boolean =>
  conclusion === CheckConclusionState.Failure ||
  conclusion === CheckConclusionState.Cancelled ||
  conclusion === CheckConclusionState.StartupFailure ||
  conclusion === CheckConclusionState.TimedOut

export const rollupWorkflowRuns = (workflowRuns: WorkflowRun[]): RollupConclusion => {
  if (workflowRuns.some((run) => isFailedConclusion(run.conclusion))) {
    return CheckConclusionState.Failure
  }
  if (workflowRuns.every((run) => run.status === CheckStatusState.Completed)) {
    return CheckConclusionState.Success
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

export const filterFailedWorkflowRuns = (workflowRuns: WorkflowRun[]): WorkflowRun[] =>
  workflowRuns.filter((run) => isFailedConclusion(run.conclusion))
