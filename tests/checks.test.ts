import { Rollup, rollupConclusion, rollupChecks } from '../src/checks.js'
import { ListChecksQuery } from '../src/generated/graphql.js'
import { CheckConclusionState, CheckStatusState } from '../src/generated/graphql-types.js'

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
                url: 'https://github.com/int128/wait-for-workflows-action/actions/runs/1',
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
                url: 'https://github.com/int128/wait-for-workflows-action/actions/runs/2',
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
                url: 'https://github.com/int128/wait-for-workflows-action/actions/runs/3',
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
      filterWorkflowNames: [],
      failFast: true,
    })
    expect(rollup).toStrictEqual<Rollup>({
      conclusion: CheckConclusionState.Success,
      workflowRuns: [
        {
          status: CheckStatusState.Completed,
          conclusion: CheckConclusionState.Skipped,
          event: 'pull_request_target',
          url: 'https://github.com/int128/wait-for-workflows-action/actions/runs/1',
          workflowName: 'workflow-1',
        },
        {
          status: CheckStatusState.Completed,
          conclusion: CheckConclusionState.Success,
          event: 'pull_request',
          url: 'https://github.com/int128/wait-for-workflows-action/actions/runs/2',
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
      filterWorkflowNames: [],
      failFast: true,
    })
    expect(rollup).toStrictEqual<Rollup>({
      conclusion: CheckConclusionState.Success,
      workflowRuns: [
        {
          status: CheckStatusState.Completed,
          conclusion: CheckConclusionState.Skipped,
          event: 'pull_request_target',
          url: 'https://github.com/int128/wait-for-workflows-action/actions/runs/1',
          workflowName: 'workflow-1',
        },
      ],
    })
  })
  it('should exclude workflows by a name', () => {
    const rollup = rollupChecks(query, {
      selfWorkflowName: 'workflow-3',
      filterWorkflowEvents: [],
      excludeWorkflowNames: ['*-1'],
      filterWorkflowNames: [],
      failFast: true,
    })
    expect(rollup).toStrictEqual<Rollup>({
      conclusion: CheckConclusionState.Success,
      workflowRuns: [
        {
          status: CheckStatusState.Completed,
          conclusion: CheckConclusionState.Success,
          event: 'pull_request',
          url: 'https://github.com/int128/wait-for-workflows-action/actions/runs/2',
          workflowName: 'workflow-2',
        },
      ],
    })
  })
  it('should filter workflows by a name', () => {
    const rollup = rollupChecks(query, {
      selfWorkflowName: 'workflow-3',
      filterWorkflowEvents: [],
      excludeWorkflowNames: [],
      filterWorkflowNames: ['*-2'],
      failFast: true,
    })
    expect(rollup).toStrictEqual<Rollup>({
      conclusion: CheckConclusionState.Success,
      workflowRuns: [
        {
          status: CheckStatusState.Completed,
          conclusion: CheckConclusionState.Success,
          event: 'pull_request',
          url: 'https://github.com/int128/wait-for-workflows-action/actions/runs/2',
          workflowName: 'workflow-2',
        },
      ],
    })
  })
  it(`should return ${CheckConclusionState.Success} if no workflow`, () => {
    const rollup = rollupChecks(query, {
      selfWorkflowName: 'workflow-3',
      filterWorkflowEvents: [],
      excludeWorkflowNames: ['*'],
      filterWorkflowNames: [],
      failFast: true,
    })
    expect(rollup).toStrictEqual<Rollup>({
      conclusion: CheckConclusionState.Success,
      workflowRuns: [],
    })
  })
})

describe('rollupWorkflowRuns', () => {
  const runSuccess = {
    status: CheckStatusState.Completed,
    conclusion: CheckConclusionState.Success,
    event: 'pull_request',
    url: 'https://github.com/int128/wait-for-workflows-action/actions/runs/1',
    workflowName: 'test-success',
  }
  const runFailure = {
    status: CheckStatusState.Completed,
    conclusion: CheckConclusionState.Failure,
    event: 'pull_request',
    url: 'https://github.com/int128/wait-for-workflows-action/actions/runs/1',
    workflowName: 'test-failure',
  }
  const runInProgress = {
    status: CheckStatusState.InProgress,
    conclusion: null,
    event: 'pull_request',
    url: 'https://github.com/int128/wait-for-workflows-action/actions/runs/1',
    workflowName: 'test-in-progress',
  }

  describe.each([false, true])('fail-fast is %p', (failFast) => {
    it(`should return ${CheckConclusionState.Success} if no workflow run is given`, () => {
      const state = rollupConclusion([], { failFast })
      expect(state).toBe(CheckConclusionState.Success)
    })

    it.each([
      { workflowRuns: [runSuccess] },
      { workflowRuns: [runSuccess, runSuccess] },
      { workflowRuns: [runSuccess, runSuccess, runSuccess] },
    ])(`should return ${CheckConclusionState.Success} if all workflow runs are succeeded`, ({ workflowRuns }) => {
      const state = rollupConclusion(workflowRuns, { failFast })
      expect(state).toBe(CheckConclusionState.Success)
    })
  })

  describe('fail-fast', () => {
    const failFast = true

    it.each([
      { workflowRuns: [runFailure] },
      { workflowRuns: [runFailure, runSuccess] },
      { workflowRuns: [runFailure, runFailure] },
      { workflowRuns: [runFailure, runInProgress] },
      { workflowRuns: [runFailure, runInProgress, runSuccess] },
    ])(`should return ${CheckConclusionState.Failure} if any workflow run is failed`, ({ workflowRuns }) => {
      const state = rollupConclusion(workflowRuns, { failFast })
      expect(state).toBe(CheckConclusionState.Failure)
    })

    it.each([
      { workflowRuns: [runInProgress] },
      { workflowRuns: [runInProgress, runSuccess] },
      { workflowRuns: [runInProgress, runInProgress] },
      { workflowRuns: [runInProgress, runSuccess, runSuccess] },
    ])(`should return null if any workflow run is not completed`, ({ workflowRuns }) => {
      const state = rollupConclusion(workflowRuns, { failFast })
      expect(state).toBe(null)
    })
  })

  describe('non fail-fast', () => {
    const failFast = false

    it.each([
      { workflowRuns: [runFailure] },
      { workflowRuns: [runFailure, runSuccess] },
      { workflowRuns: [runFailure, runFailure] },
      { workflowRuns: [runFailure, runSuccess, runSuccess] },
    ])(
      `should return ${CheckConclusionState.Failure} if all workflow runs are completed and any workflow run is failed`,
      ({ workflowRuns }) => {
        const state = rollupConclusion(workflowRuns, { failFast })
        expect(state).toBe(CheckConclusionState.Failure)
      },
    )

    it.each([
      { workflowRuns: [runInProgress] },
      { workflowRuns: [runInProgress, runSuccess] },
      { workflowRuns: [runInProgress, runFailure] },
      { workflowRuns: [runInProgress, runInProgress] },
      { workflowRuns: [runInProgress, runSuccess, runFailure] },
    ])(`should return null if any workflow run is not completed`, ({ workflowRuns }) => {
      const state = rollupConclusion(workflowRuns, { failFast })
      expect(state).toBe(null)
    })
  })
})
