# wait-for-workflows-action [![ts](https://github.com/int128/wait-for-workflows-action/actions/workflows/ts.yaml/badge.svg)](https://github.com/int128/wait-for-workflows-action/actions/workflows/ts.yaml)

This is an action to wait for all workflow runs of the current SHA.

## Problem to solve

When any workflow has `paths` filter in GitHub Actions,
we cannot enable the status check in a branch protection rule.

This action aggregates the statuses of workflow runs.

## Getting Started

To wait for all workflow runs of the current pull request,

```yaml
name: wait-for-workflows

on:
  pull_request:

jobs:
  wait-for-workflows:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: int128/wait-for-workflows-action@v1
```

### Enable a status check

You can set up a branch protection rule with the status check of `wait-for-workflows`.
For example,

<img width="775" alt="image" src="https://github.com/int128/wait-for-workflows-action/assets/321266/7f3c5d09-c0e6-439e-9e20-fbf5feb58e71">

Therefore, a pull request status looks like:

<img width="910" alt="image" src="https://github.com/int128/wait-for-workflows-action/assets/321266/167214a3-a5b9-40ce-84a6-0d39cfba5856">

## Specification

This action waits for the statuses of workflow runs against the current commit SHA.

- If any workflow run is failed, exit with an error.
- If any workflow run is not yet completed, poll the statuses.
- Otherwise, exit successfully.

It excludes the workflow of self to prevent an infinite loop.

### Inputs

| Name                    | Default                                              | Description                  |
| ----------------------- | ---------------------------------------------------- | ---------------------------- |
| `initial-delay-seconds` | 10                                                   | Initial delay before polling |
| `period-seconds`        | 15                                                   | Polling period               |
| `sha`                   | `github.event.pull_request.head.sha` or `github.sha` | Commit SHA to wait for       |
| `token`                 | `github.token`                                       | GitHub token                 |

### Outputs

None.
