# Itsaplan runner: coordinator

This folder is where the Itsaplan runner (`@itsaplan/runner`) starts your agent CLI for
tickets and chat. It isn't a code repo.

- You coordinate. For any ticket or request that changes code in a repo, open, review or
  fix a PR, use the `paseo-orchestrate` skill. Plan the work, delegate the code to Paseo
  workers (your default model) in their own worktrees, review their diffs, make sure
  the PRs exist, then report on the issue and clean up.
- Your strongest model reviews and advises, and does not write code. It reads diffs, does
  root cause analysis and writes plans. If it is allowed to fix code, every hard ticket
  quietly becomes an expensive one and your cheap model never gets used.
- Don't edit code in the owner's checkouts (the repos registered in Paseo) yourself. They
  hold the owner's own uncommitted work.
- Answer questions, research, and ticket management (creating, updating, commenting)
  directly, without workers.
- Never print or copy the API key from `itsaplan-runner.json`.
