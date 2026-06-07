import type { WebhookEvent } from '@octokit/webhooks-types'
import { describe, expect, it } from 'vitest'
import type { Context } from '../src/github.js'
import { getWorkflowFilePathsForCurrentActivityType } from '../src/workflows.js'

const getFixtureContext = (eventName: string, action?: string): Context => ({
  eventName,
  repo: {
    owner: 'int128',
    repo: 'wait-for-workflows-action',
  },
  runId: 0,
  serverUrl: 'https://github.com',
  workflow: 'example',
  workspace: import.meta.dirname,
  payload: {
    action,
  } as WebhookEvent,
})

describe('getWorkflowFilePathsForCurrentActivityType', () => {
  it('matches pull_request workflow with the default activity types', async () => {
    const workflowPathsForCurrentActivityType = await getWorkflowFilePathsForCurrentActivityType(
      getFixtureContext('pull_request', 'opened'),
    )
    expect(workflowPathsForCurrentActivityType).toEqual(['.github/workflows/wait-for-workflows.yaml'])
  })

  it('matches pull_request labeled workflow', async () => {
    const workflowPathsForCurrentActivityType = await getWorkflowFilePathsForCurrentActivityType(
      getFixtureContext('pull_request', 'labeled'),
    )
    expect(workflowPathsForCurrentActivityType).toEqual(['.github/workflows/label-fixture.yaml'])
  })

  it('matches push workflow', async () => {
    const workflowPathsForCurrentActivityType = await getWorkflowFilePathsForCurrentActivityType(
      getFixtureContext('push'),
    )
    expect(workflowPathsForCurrentActivityType).toEqual(['.github/workflows/push-fixture.yaml'])
  })

  it('returns empty when no workflow matches the current event', async () => {
    const workflowPathsForCurrentActivityType = await getWorkflowFilePathsForCurrentActivityType(
      getFixtureContext('workflow_dispatch'),
    )
    expect(workflowPathsForCurrentActivityType).toEqual([])
  })

  it('returns empty when no workflow matches the current activity type', async () => {
    const workflowPathsForCurrentActivityType = await getWorkflowFilePathsForCurrentActivityType(
      getFixtureContext('pull_request', 'edited'),
    )
    expect(workflowPathsForCurrentActivityType).toEqual([])
  })
})
