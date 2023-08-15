import * as core from '@actions/core'
import * as github from '@actions/github'
import * as actionsChecks from './queries/actionsChecks'
import { summarize } from './checks'

type Inputs = {
  initialDelaySeconds: number
  periodSeconds: number
  sha: string
  token: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  const octokit = github.getOctokit(inputs.token)

  // exclude self to prevent an infinite loop
  const selfWorkflowName = github.context.workflow
  const excludeWorkflowNames = [selfWorkflowName]
  core.info(`Excluding workflows: ${excludeWorkflowNames.join(', ')}`)

  core.info(`Waiting for initial delay ${inputs.initialDelaySeconds}s`)
  await sleep(inputs.initialDelaySeconds * 1000)

  for (;;) {
    const checks = await actionsChecks.paginate(actionsChecks.withOctokit(octokit), {
      owner: github.context.repo.owner,
      name: github.context.repo.repo,
      oid: inputs.sha,
      appId: 15368, // github-actions
    })

    const summary = summarize(checks, excludeWorkflowNames)
    core.info(JSON.stringify(summary))

    if (summary.state === 'Succeeded') {
      break
    }

    core.info(`Waiting for period ${inputs.initialDelaySeconds}s`)
    await sleep(inputs.periodSeconds * 1000)
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
