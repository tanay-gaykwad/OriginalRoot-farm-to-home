# Contributing to OriginalRoot

Thanks for helping improve OriginalRoot. Changes should keep farmer control, transparent pricing, privacy, and the distinction between recorded information and independently verified facts clear.

## Before opening an issue

- Check the [existing issues](https://github.com/tanay-gaykwad/originalroot-farm-to-home/issues) for a duplicate.
- For a bug, include the page or workflow, steps to reproduce, expected result, actual result, and relevant non-sensitive logs.
- For a product proposal, explain which grower, customer, or operator problem it addresses and how success could be measured.
- Never include real names, phone numbers, addresses, passwords, bootstrap keys, database files, or payment details.
- For a suspected vulnerability, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Local development

Requirements: Node.js 22, pnpm 11.25.0, and Python 3.12. Docker Desktop is needed only for the Compose workflow.

```powershell
pnpm install --frozen-lockfile
$env:ORIGINALROOT_OPERATOR_TOKEN = "use-a-long-random-local-key"
python api/server.py
```

In another terminal:

```powershell
pnpm dev
```

Open `http://localhost:5173`. Vite forwards API requests to the local server on port 8080. The database defaults to a local SQLite file; use only fictional data during development.

## Before submitting a change

Run the checks that match your change:

```powershell
pnpm build
python -m py_compile api/server.py api/backup.py
```

For changes to the static preview, also run `pnpm build:pages`. GitHub Actions runs the frontend build, API syntax check, and Docker image build on pushes and pull requests.

## Pull requests

1. Create a focused branch from `main`.
2. Keep unrelated changes separate and update the relevant phase guide or README when behavior changes.
3. Describe the user problem, implementation, manual checks, and any known limitations.
4. Include screenshots for meaningful visual changes and use fictional data in them.
5. Confirm the automated checks pass before requesting review.

There is no promise that every proposal will be accepted. For significant workflow or data-model changes, open an issue first so the scope can be discussed.
