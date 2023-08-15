import assert from 'assert'
import { ActionsChecksQuery } from './generated/graphql'
import { CheckConclusionState, CheckStatusState, StatusState } from './generated/graphql-types'

type Summary = {
  state: State
  workflowRuns: WorkflowRun[]
}

type State = 'Pending' | 'Succeeded' | 'Failed'

type WorkflowRun = {
  status: CheckStatusState
  conclusion: CheckConclusionState | null
  event: string
  workflowName: string
}

export const summarize = (checks: ActionsChecksQuery, excludeWorkflowNames: string[]): Summary => {
  assert(checks.repository != null)
  assert(checks.repository.object != null)
  assert(checks.repository.object.__typename === 'Commit')

  const workflowRuns: WorkflowRun[] = []
  assert(checks.repository.object.checkSuites != null)
  assert(checks.repository.object.checkSuites.nodes != null)
  for (const node of checks.repository.object.checkSuites.nodes) {
    assert(node != null)
    assert(node.conclusion !== undefined)
    assert(node.workflowRun != null)

    const workflowName = node.workflowRun.workflow.name
    if (excludeWorkflowNames.includes(workflowName)) {
      continue
    }

    workflowRuns.push({
      status: node.status,
      conclusion: node.conclusion,
      event: node.workflowRun.event,
      workflowName,
    })
  }

  assert(checks.repository.object.statusCheckRollup != null)
  const state = calculateState(checks.repository.object.statusCheckRollup.state, workflowRuns)
  return { state, workflowRuns }
}

const calculateState = (statusCheckRollupState: StatusState, workflowRuns: WorkflowRun[]): State => {
  if (statusCheckRollupState === StatusState.Failure) {
    return 'Failed'
  }
  if (workflowRuns.some((run) => run.status !== CheckStatusState.Completed)) {
    return 'Pending'
  }
  if (workflowRuns.some((run) => run.conclusion === CheckConclusionState.Failure)) {
    return 'Failed'
  }
  return 'Succeeded'
}
