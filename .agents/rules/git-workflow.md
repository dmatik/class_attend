# Git Workflow & Operational Rules

## 1. Absolute Rule: No Autonomous Git Commits or Pushes
- **Never** execute `git commit` or `git push` unless the user explicitly commands it in the current turn.
- If the user says "create a side branch", create and switch to the branch, but ask or wait for the user to instruct you to commit and push.
- Keep all files unstaged and modified locally so the user has full review visibility before committing.

## 2. Protected Main Branch: Always Use Side Branches
- **Never push directly to `main`**. Pushing to `origin main` is strictly prohibited.
- All work, bug fixes, and features must be performed on a dedicated side branch.
- When instructed to push, push to the side branch: `git push -u origin <branch-name>` and provide the Pull Request link to the user.

## 3. Branching Conventions
When asked to create branches, use the following prefixes:
- `feature/<feature-name>`: Net-new capabilities or major additions.
- `fix/<bug-description>`: Bug fixes or defect repairs.
- `chore/<task-description>`: Dependency updates, refactoring, or maintenance tasks.
- `docs/<doc-topic>`: Documentation or guide updates.

## 3. Clean Diffs & Review Hygiene
- Never commit build artifacts (`dist/`), SQLite databases (`data/`), log files (`*.log`), or Playwright reports (`test-results/`, `playwright-report/`).
- Always run `git status` and `git diff` to verify only intended changes are touched.
- Write concise, conventional commit messages: `feat(...)`, `fix(...)`, `test(...)`, `chore(...)`, `docs(...)`.

