import assert from 'assert'
import { ActionsChecksQuery } from './generated/graphql'
import { CheckConclusionState, CheckStatusState } from './generated/graphql-types'

type Summary = {
  state: State
  workflowRuns: WorkflowRun[]
}

type State = 'Pending' | 'Succeeded' | 'Failed'

type WorkflowRun = {
  status: CheckStatusState
  conclusion: CheckConclusionState
  event: string
  filepath: string
}

export const summarize = (checks: ActionsChecksQuery): Summary => {
  assert(checks.repository != null)
  assert(checks.repository.object != null)
  assert(checks.repository.object.__typename === 'Commit')

  assert(checks.repository.object.statusCheckRollup != null)
  // if (checks.repository.object.statusCheckRollup.state === StatusState.Failure) {
  //   return
  // }

  const workflowRuns: WorkflowRun[] = []
  assert(checks.repository.object.checkSuites != null)
  assert(checks.repository.object.checkSuites.nodes != null)
  for (const node of checks.repository.object.checkSuites.nodes) {
    assert(node != null)
    assert(node.conclusion != null)
    assert(node.workflowRun != null)
    assert(node.workflowRun.file != null)

    workflowRuns.push({
      status: node.status,
      conclusion: node.conclusion,
      event: node.workflowRun.event,
      filepath: node.workflowRun.file.path,
    })
  }

  let state: State = 'Pending'
  if (workflowRuns.every((run) => run.status === CheckStatusState.Completed)) {
    if (workflowRuns.some((run) => run.conclusion === CheckConclusionState.Failure)) {
      state = 'Failed'
    } else {
      state = 'Succeeded'
    }
  }

  return { state, workflowRuns }
}
