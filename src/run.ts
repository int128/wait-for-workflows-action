import * as core from '@actions/core'
import * as github from '@actions/github'
import * as actionsChecks from './queries/actionsChecks'
import { summarize } from './checks'

type Inputs = {
  sha: string
  token: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  const octokit = github.getOctokit(inputs.token)

  for (let i = 0; i < 10; i++) {
    const checks = await actionsChecks.paginate(actionsChecks.withOctokit(octokit), {
      owner: github.context.repo.owner,
      name: github.context.repo.repo,
      oid: inputs.sha,
      appId: 15368, // github-actions
    })

    core.info(JSON.stringify(checks, undefined, 2))

    const summary = summarize(checks)
    core.info(JSON.stringify(summary))

    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}
