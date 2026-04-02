# Preflight Guard Action

Free open-source GitHub Action for a small set of pre-launch red-flag checks in supported Next.js + Vercel / Supabase setups.

This action is for beginner builders and solo builders who want a simple pre-deploy check in GitHub Actions before launch. It is intentionally narrow. It looks for a small set of common red flags and writes a plain-language report you can review before shipping.


#### Are you too new to GitHub Actions to understand this everything? Here is a step-by-step setup guide with screenshots, see [HOW_TO_TRY.md](./HOW_TO_TRY.md). Don't worry :) It's super Beginner friendly!


## Who This Is For

- Beginner or solo builders shipping a Next.js app
- Teams using Vercel, Supabase, or both in a supported setup
- People who want a lightweight warning step in CI, not a broad scanner

## Supported Stacks

- Next.js + Vercel
- Next.js + Supabase
- Next.js + Supabase + Vercel

## What It Checks

The exact rules come from the core engine, but in simple terms this action checks for a small set of red flags around:

- auth-related route handling
- middleware and protection gaps the checker knows how to recognize
- Supabase setup mistakes covered by the current rule packs
- Vercel or project configuration issues covered by the current rule packs

The reports explain what was found, why it matters, and the minimum fix to review.

## What It Does Not Do

- It is not a broad security scanner
- It does not test runtime behavior
- It does not review every possible Next.js, Supabase, or Vercel mistake
- It does not add fixes automatically
- It is not proof that an app is safe or ready

## How To Use It

Add this action to a workflow in the app repository you want to check.
The action installs and builds its own runtime from the action repository, then scans the checked-out repository in your workflow workspace.

```yaml
name: Preflight Guard

on:
  pull_request:
  workflow_dispatch:

jobs:
  preflight:
    runs-on: ubuntu-latest

    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Run preflight guard
        id: preflight
        uses: aidenplabs/preflight-guard-action@v1
        with:
          path: .
          output-dir: .preflight-ci
          fail-on: no

      - name: Upload reports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: preflight-report
          path: .preflight-ci/
```


<br>

## Inputs

| Input | Default | What it does |
| --- | --- | --- |
| `path` | `.` | Path inside the checked-out workflow repository to scan |
| `output-dir` | `.preflight-ci` | Directory inside the checked-out workflow repository where the Markdown and JSON reports are written |
| `fail-on` | `no` | Failure policy: `caution`, `no`, or `never` |

## Outputs And What To Expect

When the action runs, you should expect three main things:

1. A GitHub step summary with a compact recommendation section first, followed by the generated full Markdown report when it is available.
2. A Markdown report at `OUTPUT_DIR/preflight-report.md`.
3. A JSON report at `OUTPUT_DIR/preflight-report.json`.

The action also exposes outputs you can use in later workflow steps:

- `ship-recommendation`
- `recommendation-summary`
- `recommendation-basis`
- `support-status`
- `combination`
- `stack-confidence`
- `profile-fit`
- `json-report-path`
- `markdown-report-path`
- `exit-code`

## Failure Modes

- `fail-on: no` fails the job only when the recommendation is `no`
- `fail-on: caution` fails on stronger warnings as defined by the checker
- `fail-on: never` always exits successfully, which is useful if you only want reports

## Limitations

- The action only supports the current narrow set of stack combinations the core engine recognizes
- The checks are heuristic static checks
- Some unsupported or partially supported project shapes may be marked as review-only
- The reports help you decide what to inspect next, but they do not replace manual review

## Core Engine

This repository is the GitHub Action distribution surface. 

The checking engine and rule logic live in the main open-source project: [preflight-guard](https://github.com/aidenplabs/preflight-guard).

Changes to rule behavior, stack detection, or findings generally belong in the core repository, not here.



Looking for the GitHub Action version? See [preflight-guard-action](https://github.com/aidenplabs/preflight-guard-action).


## License

This project is available under the MIT License. See [LICENSE](/LICENSE).
