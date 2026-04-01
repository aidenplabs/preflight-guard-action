# Contributing

Thanks for helping improve the action repo.

## Scope Of This Repository

This repository is the GitHub Action distribution surface for the checker. Changes that belong here usually include:

- `README.md`, `LICENSE`, and other public docs
- `action.yml`
- packaging and build setup for the action
- small action-wrapper fixes that do not change checker behavior

Changes that belong in the core repository instead include:

- new rules or findings
- stack detection changes
- scoring or recommendation logic changes
- broader product behavior changes

## Testing Changes Safely

Use repo-local commands before opening a pull request:

```bash
npm ci
npm run check
npm run build
```

If you want to sanity-check the local scanner wrapper, you can also run:

```bash
npm run scan -- . --output .preflight-ci
```

Review the generated report output before proposing a change.

## Pull Requests

- Keep changes small and action-specific
- Do not add workflow files to this repository unless maintainers explicitly ask for them
- If a change would alter findings or detection behavior, move that work to the core repository instead
