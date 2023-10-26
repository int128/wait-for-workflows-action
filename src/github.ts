import { getOctokitOptions, GitHub } from '@actions/github/lib/utils'
import * as pluginRetry from '@octokit/plugin-retry'

export type Octokit = InstanceType<typeof GitHub>

export const getOctokit = (token: string): Octokit => {
  const MyOctokit = GitHub.plugin(pluginRetry.retry)
  return new MyOctokit(getOctokitOptions(token))
}
