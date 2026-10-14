import assert from 'node:assert'
import type { WorkflowRunAnnotationsQuery } from './generated/graphql.js'
import { CheckAnnotationLevel } from './generated/graphql-types.js'

export const getFailureAnnotationMessages = (query: WorkflowRunAnnotationsQuery) => {
  assert(query.node != null, `node must not be null`)
  assert(query.node.checkSuite.checkRuns != null, `node.checkSuite.checkRuns must not be null`)
  assert(query.node.checkSuite.checkRuns.nodes != null, `query.node.checkSuite.checkRuns.nodes must not be null`)

  const messages = []
  for (const checkRunNode of query.node.checkSuite.checkRuns.nodes) {
    assert(checkRunNode != null, `checkRunNode must not be null`)
    assert(checkRunNode.annotations != null, `checkRunNode.annotations must not be null`)
    assert(checkRunNode.annotations.nodes != null, `checkRunNode.annotations.nodes must not be null`)
    for (const annotationNode of checkRunNode.annotations.nodes) {
      assert(annotationNode != null, `annotationNode must not be null`)
      if (annotationNode.annotationLevel === CheckAnnotationLevel.Failure) {
        messages.push(annotationNode.message)
      }
    }
  }
  return messages
}
