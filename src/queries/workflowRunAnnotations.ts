import * as core from '@actions/core'
import type { Octokit } from '@octokit/action'
import type { WorkflowRunAnnotationsFragment } from '../generated/graphql.js'

const fragment = /* GraphQL */ `
  fragment WorkflowRunAnnotations on WorkflowRun {
    id
    checkSuite {
      checkRuns(first: 100, filterBy: {
        conclusions: [FAILURE]
      }) {
        nodes {
          annotations(first: 10) {
            nodes {
              annotationLevel
              message
            }
          }
        }
      }
    }
  }
`

const createQuery = (idVars: string[]) => `
  query workflowRunAnnotations(${idVars.map((v) => `$${v}: ID!`).join(', ')}) {
    ${idVars.map((v) => `${v}: node(id: $${v}) { ...WorkflowRunAnnotations }`).join('\n')}
  }
  ${fragment}
`

export type WorkflowRunAnnotationsQuery = {
  [vIndex: string]: WorkflowRunAnnotationsFragment
}

export const executeWorkflowRunAnnotationsQuery = async (octokit: Octokit, workflowRunIds: string[]) => {
  const idVarMap = new Map(workflowRunIds.map((workflowRunId, index) => [`v${index}`, workflowRunId]))
  const query = createQuery(idVarMap.keys().toArray())
  const variables = Object.fromEntries(idVarMap)
  core.info(JSON.stringify(variables, null, 2))
  return await octokit.graphql<WorkflowRunAnnotationsQuery>(query, variables)
}
