# wait-for-workflows-action [![ts](https://github.com/int128/wait-for-workflows-action/actions/workflows/ts.yaml/badge.svg)](https://github.com/int128/wait-for-workflows-action/actions/workflows/ts.yaml)

This is an action to wait for all workflow runs of the current SHA.

## Purpose

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

## How it works

This action fetches the workflow runs against the current commit SHA.
It determines the rollup state as follows:

- If any workflow run is failing, this action exits with an error.
- If all workflow runs are completed, this action exits successfully.
- Otherwise, check again.

It excludes the workflow of self to prevent an infinite loop.

It filters the workflows by the current event such as `push` or `pull_request`.

### Exclude or filter workflows by name patterns

By default, this action evaluates all workflow runs.
You can exclude workflow runs by glob name patterns.

```yaml
jobs:
  wait-for-workflows:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: int128/wait-for-workflows-action@v1
        with:
          exclude-workflow-names: |
            * / generate-graphql
```

You can also filter workflow runs by glob name patterns.

```yaml
jobs:
  wait-for-backend-ci:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: int128/wait-for-workflows-action@v1
        with:
          filter-workflow-names: |
            backend / *
```

## Caveat

### Cost of GitHub-hosted runners :moneybag:

This action runs until all workflows are completed.
It may increase the cost of GitHub-hosted runners.
If your repository is private, it is strongly recommended to use your self-hosted runners.

### GitHub API rate limit

This action calls the GitHub GraphQL API until all workflows are completed.
It is recommended to use a token of GitHub App or PAT, instead of the default `GITHUB_TOKEN`.
See [rate limiting](https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting) for details.

## Specification

### Inputs

| Name                        | Default                                              | Description                        |
| --------------------------- | ---------------------------------------------------- | ---------------------------------- |
| `filter-workflow-names`     | -                                                    | Filter workflows by name patterns  |
| `exclude-workflow-names`    | -                                                    | Exclude workflows by name patterns |
| `filter-workflow-events`    | `github.event_name`                                  | Filter workflows by events         |
| `initial-delay-seconds`     | 10                                                   | Initial delay before polling       |
| `period-seconds`            | 15                                                   | Polling period                     |
| `page-size-of-check-suites` | 100                                                  | Page size of CheckSuites query     |
| `sha`                       | `github.event.pull_request.head.sha` or `github.sha` | Commit SHA to wait for             |
| `token`                     | `github.token`                                       | GitHub token                       |

### Outputs

| Name                    | Description                   |
| ----------------------- | ----------------------------- |
| `rollup-state`          | Either `SUCCESS` or `FAILURE` |
| `failed-workflow-names` | List of failed workflow names |
