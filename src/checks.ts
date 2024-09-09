import assert from 'assert'
import * as minimatch from 'minimatch'
import { ListChecksQuery } from './generated/graphql.js'
import { CheckConclusionState, CheckStatusState, StatusState } from './generated/graphql-types.js'

export type Rollup = {
  state: State
  workflowRuns: WorkflowRun[]
}

type State = StatusState.Pending | StatusState.Success | StatusState.Failure

type WorkflowRun = {
  status: CheckStatusState
  conclusion: CheckConclusionState | null
  event: string
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
      workflowName: node.workflowRun.workflow.name,
    }
  })

  const excludeWorkflowNameMatchers = options.excludeWorkflowNames.map((pattern) => minimatch.filter(pattern))
  const filterWorkflowNameMatchers = options.filterWorkflowNames.map((pattern) => minimatch.filter(pattern))

  const workflowRuns = rawWorkflowRuns.filter((workflowRun) => {
    // exclude self to prevent an infinite loop
    if (workflowRun.workflowName === options.selfWorkflowName) {
      return false
    }
    // filter workflows by event
    if (options.filterWorkflowEvents.length > 0) {
      if (!options.filterWorkflowEvents.includes(workflowRun.event)) {
        return false
      }
    }
    // exclude workflows by names
    if (excludeWorkflowNameMatchers.length > 0) {
      if (excludeWorkflowNameMatchers.some((match) => match(workflowRun.workflowName))) {
        return false
      }
    }
    // filter workflows by names
    if (filterWorkflowNameMatchers.length > 0) {
      if (!filterWorkflowNameMatchers.some((match) => match(workflowRun.workflowName))) {
        return false
      }
    }
    return true
  })
  const state = rollupWorkflowRuns(workflowRuns)
  return { state, workflowRuns }
}

export const rollupWorkflowRuns = (workflowRuns: WorkflowRun[]): State => {
  if (
    workflowRuns.some(
      (run) =>
        run.conclusion === CheckConclusionState.Failure ||
        run.conclusion === CheckConclusionState.Cancelled ||
        run.conclusion === CheckConclusionState.StartupFailure ||
        run.conclusion === CheckConclusionState.TimedOut,
    )
  ) {
    return StatusState.Failure
  }
  if (workflowRuns.every((run) => run.status === CheckStatusState.Completed)) {
    return StatusState.Success
  }
  return StatusState.Pending
}

export const filterFailedWorkflowRuns = (workflowRuns: WorkflowRun[]): WorkflowRun[] =>
  workflowRuns.filter((run) => run.conclusion === CheckConclusionState.Failure)
