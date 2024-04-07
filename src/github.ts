import * as github from '@actions/github'
import * as pluginRetry from '@octokit/plugin-retry'

export type Octokit = ReturnType<typeof github.getOctokit>

export const getOctokit = (token: string): Octokit => github.getOctokit(token, pluginRetry.retry)
