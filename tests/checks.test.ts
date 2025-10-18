import { describe, expect, it } from 'vitest'
import {
  determineRollupConclusion,
  determineRollupStatus,
  filterLatestWorkflowRuns,
  type Rollup,
  rollupChecks,
} from '../src/checks.js'
import type { ListChecksQuery } from '../src/generated/graphql.js'
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
    })
    expect(rollup).toStrictEqual<Rollup>({
      status: CheckStatusState.Completed,
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
    })
    expect(rollup).toStrictEqual<Rollup>({
      status: CheckStatusState.Completed,
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
    })
    expect(rollup).toStrictEqual<Rollup>({
      status: CheckStatusState.Completed,
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
    })
    expect(rollup).toStrictEqual<Rollup>({
      status: CheckStatusState.Completed,
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
    })
    expect(rollup).toStrictEqual<Rollup>({
      status: CheckStatusState.Completed,
      conclusion: CheckConclusionState.Success,
      workflowRuns: [],
    })
  })
})

describe('filterLatestWorkflowRuns', () => {
  it('returns the latest workflow runs by name and event', () => {
    const runs = [
      {
        status: CheckStatusState.Completed,
        conclusion: CheckConclusionState.Success,
        event: 'pull_request',
        url: 'https://github.com/int128/wait-for-workflows-action/actions/runs/1',
        workflowName: 'test-success',
      },
      {
        status: CheckStatusState.Completed,
        conclusion: CheckConclusionState.Skipped,
        event: 'pull_request',
        url: 'https://github.com/int128/wait-for-workflows-action/actions/runs/2',
        workflowName: 'test-success',
      },
    ]
    const latestWorkflowRuns = filterLatestWorkflowRuns(runs)
    expect(latestWorkflowRuns).toStrictEqual([
      {
        status: CheckStatusState.Completed,
        conclusion: CheckConclusionState.Skipped,
        event: 'pull_request',
        url: 'https://github.com/int128/wait-for-workflows-action/actions/runs/2',
        workflowName: 'test-success',
      },
    ])
  })
})

describe('determineRollup functions', () => {
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
  const runQueued = {
    status: CheckStatusState.Queued,
    conclusion: null,
    event: 'pull_request',
    url: 'https://github.com/int128/wait-for-workflows-action/actions/runs/1',
    workflowName: 'test-queued',
  }

  describe('determineRollupConclusion', () => {
    it(`should return ${CheckConclusionState.Success} if no workflow run is given`, () => {
      const conclusion = determineRollupConclusion([])
      expect(conclusion).toBe(CheckConclusionState.Success)
    })

    it.each([
      { workflowRuns: [runSuccess] },
      { workflowRuns: [runSuccess, runSuccess] },
      { workflowRuns: [runSuccess, runSuccess, runSuccess] },
    ])(`should return ${CheckConclusionState.Success} if all workflow runs are succeeded`, ({ workflowRuns }) => {
      const conclusion = determineRollupConclusion(workflowRuns)
      expect(conclusion).toBe(CheckConclusionState.Success)
    })

    it.each([
      { workflowRuns: [runFailure] },
      { workflowRuns: [runFailure, runSuccess] },
      { workflowRuns: [runFailure, runFailure] },
      { workflowRuns: [runFailure, runInProgress] },
      { workflowRuns: [runFailure, runInProgress, runSuccess] },
    ])(`should return ${CheckConclusionState.Failure} if any workflow run is failed`, ({ workflowRuns }) => {
      const conclusion = determineRollupConclusion(workflowRuns)
      expect(conclusion).toBe(CheckConclusionState.Failure)
    })

    it.each([
      { workflowRuns: [runInProgress] },
      { workflowRuns: [runInProgress, runSuccess] },
      { workflowRuns: [runInProgress, runInProgress] },
      { workflowRuns: [runInProgress, runSuccess, runSuccess] },
    ])(`should return null if any workflow run is not completed`, ({ workflowRuns }) => {
      const conclusion = determineRollupConclusion(workflowRuns)
      expect(conclusion).toBe(null)
    })
  })

  describe('determineRollupStatus', () => {
    it(`should return ${CheckStatusState.Completed} if no workflow run is given`, () => {
      const status = determineRollupStatus([])
      expect(status).toBe(CheckStatusState.Completed)
    })

    it.each([
      { workflowRuns: [runSuccess] },
      { workflowRuns: [runFailure] },
      { workflowRuns: [runSuccess, runFailure] },
    ])(`should return ${CheckStatusState.Completed} if all workflow runs are completed`, ({ workflowRuns }) => {
      const status = determineRollupStatus(workflowRuns)
      expect(status).toBe(CheckStatusState.Completed)
    })

    it.each([
      { workflowRuns: [runInProgress] },
      { workflowRuns: [runSuccess, runInProgress] },
      { workflowRuns: [runFailure, runInProgress] },
    ])(`should return null if any workflow run is in progress`, ({ workflowRuns }) => {
      const status = determineRollupStatus(workflowRuns)
      expect(status).toBe(null)
    })

    it.each([
      { workflowRuns: [runQueued] },
      { workflowRuns: [runInProgress, runQueued] },
      { workflowRuns: [runSuccess, runQueued] },
      { workflowRuns: [runFailure, runQueued] },
    ])(`should return null if any workflow run is queued`, ({ workflowRuns }) => {
      const status = determineRollupStatus(workflowRuns)
      expect(status).toBe(null)
    })
  })
})
