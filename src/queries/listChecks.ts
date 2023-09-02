import * as core from '@actions/core'
import { GitHub } from '@actions/github/lib/utils'
import { ListChecksQuery, ListChecksQueryVariables } from '../generated/graphql'
import assert from 'assert'

type Octokit = InstanceType<typeof GitHub>

const query = /* GraphQL */ `
  query listChecks($owner: String!, $name: String!, $oid: GitObjectID!, $appId: Int!, $afterCursor: String) {
    rateLimit {
      cost
      remaining
    }
    repository(owner: $owner, name: $name) {
      object(oid: $oid) {
        __typename
        ... on Commit {
          checkSuites(filterBy: { appId: $appId }, first: 100, after: $afterCursor) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              workflowRun {
                event
                workflow {
                  name
                }
              }
              status
              conclusion
            }
          }
        }
      }
    }
  }
`

type QueryFunction = (v: ListChecksQueryVariables) => Promise<ListChecksQuery>

export const withOctokit =
  (o: Octokit): QueryFunction =>
  async (v: ListChecksQueryVariables) =>
    await o.graphql(query, v)

export const paginate = async (
  fn: QueryFunction,
  v: ListChecksQueryVariables,
  previous?: ListChecksQuery,
): Promise<ListChecksQuery> => {
  core.startGroup(`ListChecksQuery(${JSON.stringify(v)})`)
  const query = await fn(v)
  core.debug(JSON.stringify(query, undefined, 2))
  core.endGroup()

  assert(query.rateLimit != null)
  assert(query.repository != null)
  assert(query.repository.object != null)
  assert.strictEqual(query.repository.object.__typename, 'Commit')
  assert(query.repository.object.checkSuites != null)
  assert(query.repository.object.checkSuites.nodes != null)

  if (previous !== undefined) {
    assert(previous.repository != null)
    assert(previous.repository.object != null)
    assert.strictEqual(previous.repository.object.__typename, 'Commit')
    assert(previous.repository.object.checkSuites != null)
    assert(previous.repository.object.checkSuites.nodes != null)
    query.repository.object.checkSuites.nodes.unshift(...previous.repository.object.checkSuites.nodes)
  }

  core.info(
    `Received ${query.repository.object.checkSuites.nodes.length} / ${query.repository.object.checkSuites.totalCount} checkSuites ` +
      `(rate-limit-remaining: ${query.rateLimit.remaining})`,
  )

  if (!query.repository.object.checkSuites.pageInfo.hasNextPage) {
    return query
  }
  const afterCursor = query.repository.object.checkSuites.pageInfo.endCursor
  return await paginate(fn, { ...v, afterCursor }, query)
}
