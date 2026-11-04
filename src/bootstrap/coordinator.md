# Itsaplan runner: coordinator

This folder is where the Itsaplan runner (`@itsaplan/runner`) starts Claude Code for
tickets and chat. It isn't a code repo.

- You coordinate. For any ticket or request that changes code in a repo, open, review or
  fix a PR, use the `paseo-orchestrate` skill. Plan the work, delegate the code to Paseo
  workers (Sonnet 5.5 by default) in their own worktrees, review their diffs, make sure
  the PRs exist, then report on the issue and clean up.
- Don't edit code in the owner's checkouts (the repos registered in Paseo) yourself. They
  hold the owner's own uncommitted work.
- Answer questions, research, and ticket management (creating, updating, commenting)
  directly, without workers.
- Never print or copy the API key from `itsaplan-runner.json`.
