import * as core from '@actions/core'
import * as github from '@actions/github'
import * as actionsChecks from './queries/actionsChecks'

type Inputs = {
  sha: string
  token: string
}

export const run = async (inputs: Inputs): Promise<void> => {
  const octokit = github.getOctokit(inputs.token)

  const checks = await actionsChecks.paginate(actionsChecks.withOctokit(octokit), {
    owner: github.context.repo.owner,
    name: github.context.repo.repo,
    oid: inputs.sha,
    appId: 15368, // github-actions
  })

  core.info(JSON.stringify(checks, undefined, 2))
}
