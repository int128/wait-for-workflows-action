import assert from 'node:assert'
import { CheckAnnotationLevel } from './generated/graphql-types.js'
import type { WorkflowRunAnnotationsQuery } from './queries/workflowRunAnnotations.js'

export const getFailureAnnotationMessages = (query: WorkflowRunAnnotationsQuery) => {
  const messages = []
  for (const fragment of Object.values(query)) {
    assert(fragment.checkSuite.checkRuns != null, `checkSuite.checkRuns must not be null`)
    assert(fragment.checkSuite.checkRuns.nodes != null, `checkSuite.checkRuns.nodes must not be null`)
    for (const checkRunNode of fragment.checkSuite.checkRuns.nodes) {
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
  }
  return messages
}
