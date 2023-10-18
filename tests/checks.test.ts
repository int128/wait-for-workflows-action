import { Rollup, rollupWorkflowRuns, rollupChecks } from '../src/checks'
import { ListChecksQuery } from '../src/generated/graphql'
import { CheckConclusionState, CheckStatusState, StatusState } from '../src/generated/graphql-types'

describe('rollupChecks', () => {
  const query: ListChecksQuery = {
    rateLimit: {
      cost: 1,
      remaining: 5000,
    },
    repository: {
      object: {
        __typename: 'Commit',
        checkSuites: {
          totalCount: 3,
          pageInfo: {
            hasNextPage: false,
          },
          nodes: [
            {
              workflowRun: {
                event: 'pull_request_target',
                workflow: {
                  name: 'workflow-1',
                },
              },
              status: CheckStatusState.Completed,
              conclusion: CheckConclusionState.Skipped,
            },
            {
              workflowRun: {
                event: 'pull_request',
                workflow: {
                  name: 'workflow-2',
                },
              },
              status: CheckStatusState.Completed,
              conclusion: CheckConclusionState.Success,
            },
            {
              workflowRun: {
                event: 'pull_request',
                workflow: {
                  name: 'workflow-3',
                },
              },
              status: CheckStatusState.InProgress,
              conclusion: null,
            },
          ],
        },
      },
    },
  }
  it('should exclude self workflow', () => {
    const rollup = rollupChecks(query, {
      selfWorkflowName: 'workflow-3',
      filterWorkflowEvents: [],
      excludeWorkflowNames: [],
    })
    expect(rollup).toStrictEqual<Rollup>({
      state: StatusState.Success,
      workflowRuns: [
        {
          status: CheckStatusState.Completed,
          conclusion: CheckConclusionState.Skipped,
          event: 'pull_request_target',
          workflowName: 'workflow-1',
        },
        {
          status: CheckStatusState.Completed,
          conclusion: CheckConclusionState.Success,
          event: 'pull_request',
          workflowName: 'workflow-2',
        },
      ],
    })
  })
  it('should filter given events', () => {
    const rollup = rollupChecks(query, {
      selfWorkflowName: 'workflow-3',
      filterWorkflowEvents: ['pull_request_target'],
      excludeWorkflowNames: [],
    })
    expect(rollup).toStrictEqual<Rollup>({
      state: StatusState.Success,
      workflowRuns: [
        {
          status: CheckStatusState.Completed,
          conclusion: CheckConclusionState.Skipped,
          event: 'pull_request_target',
          workflowName: 'workflow-1',
        },
      ],
    })
  })
  it('should exclude given workflows', () => {
    const rollup = rollupChecks(query, {
      selfWorkflowName: 'workflow-3',
      filterWorkflowEvents: [],
      excludeWorkflowNames: ['*-1'],
    })
    expect(rollup).toStrictEqual<Rollup>({
      state: StatusState.Success,
      workflowRuns: [
        {
          status: CheckStatusState.Completed,
          conclusion: CheckConclusionState.Success,
          event: 'pull_request',
          workflowName: 'workflow-2',
        },
      ],
    })
  })
  it(`should return ${StatusState.Success} if no workflow`, () => {
    const rollup = rollupChecks(query, {
      selfWorkflowName: 'workflow-3',
      filterWorkflowEvents: [],
      excludeWorkflowNames: ['*'],
    })
    expect(rollup).toStrictEqual<Rollup>({
      state: StatusState.Success,
      workflowRuns: [],
    })
  })
})

describe('rollupWorkflowRuns', () => {
  it(`should return ${StatusState.Success} if no workflow run is given`, () => {
    const state = rollupWorkflowRuns([])
    expect(state).toBe(StatusState.Success)
  })

  const runSuccess = {
    status: CheckStatusState.Completed,
    conclusion: CheckConclusionState.Success,
    event: 'pull_request',
    workflowName: 'test-success',
  }
  const runFailure = {
    status: CheckStatusState.Completed,
    conclusion: CheckConclusionState.Failure,
    event: 'pull_request',
    workflowName: 'test-failure',
  }
  const runInProgress = {
    status: CheckStatusState.InProgress,
    conclusion: null,
    event: 'pull_request',
    workflowName: 'test-in-progress',
  }

  it.each([
    { workflowRuns: [runSuccess] },
    { workflowRuns: [runSuccess, runSuccess] },
    { workflowRuns: [runSuccess, runSuccess, runSuccess] },
  ])(
    `should return ${StatusState.Success} if all workflow runs are ${CheckConclusionState.Success}`,
    ({ workflowRuns }) => {
      const state = rollupWorkflowRuns(workflowRuns)
      expect(state).toBe(StatusState.Success)
    },
  )

  it.each([
    { workflowRuns: [runFailure] },
    { workflowRuns: [runSuccess, runFailure] },
    { workflowRuns: [runFailure, runFailure] },
    { workflowRuns: [runInProgress, runFailure] },
    { workflowRuns: [runSuccess, runSuccess, runFailure] },
    { workflowRuns: [runInProgress, runSuccess, runFailure] },
  ])(
    `should return ${StatusState.Failure} if any workflow run is ${CheckConclusionState.Failure}`,
    ({ workflowRuns }) => {
      const state = rollupWorkflowRuns(workflowRuns)
      expect(state).toBe(StatusState.Failure)
    },
  )

  it.each([
    { workflowRuns: [runInProgress] },
    { workflowRuns: [runSuccess, runInProgress] },
    { workflowRuns: [runInProgress, runInProgress] },
    { workflowRuns: [runSuccess, runSuccess, runInProgress] },
    { workflowRuns: [runInProgress, runSuccess, runInProgress] },
    { workflowRuns: [runInProgress, runInProgress, runInProgress] },
  ])(
    `should return ${StatusState.Pending} if any workflow run is not ${CheckStatusState.Completed}`,
    ({ workflowRuns }) => {
      const state = rollupWorkflowRuns(workflowRuns)
      expect(state).toBe(StatusState.Pending)
    },
  )
})
