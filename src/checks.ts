import assert from 'assert'
import * as minimatch from 'minimatch'
import { ListChecksQuery } from './generated/graphql'
import { CheckConclusionState, CheckStatusState, StatusState } from './generated/graphql-types'

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
  excludeWorkflowNames: string[]
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
  const workflowRuns = rawWorkflowRuns.filter((workflowRun) => {
    // exclude self to prevent an infinite loop
    if (workflowRun.workflowName === options.selfWorkflowName) {
      return false
    }
    // exclude the specified workflow names
    if (excludeWorkflowNameMatchers.some((match) => match(workflowRun.workflowName))) {
      return false
    }
    return true
  })
  const state = rollupWorkflowRuns(workflowRuns)
  return { state, workflowRuns }
}

export const rollupWorkflowRuns = (workflowRuns: WorkflowRun[]): State => {
  if (workflowRuns.some((run) => run.conclusion === CheckConclusionState.Failure)) {
    return StatusState.Failure
  }
  if (workflowRuns.every((run) => run.status === CheckStatusState.Completed)) {
    return StatusState.Success
  }
  return StatusState.Pending
}

export const filterFailedWorkflowRuns = (workflowRuns: WorkflowRun[]): WorkflowRun[] =>
  workflowRuns.filter((run) => run.conclusion === CheckConclusionState.Failure)
