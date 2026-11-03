# Ayori Compare working agreement

- Read `docs/PROGRESS.md` before implementation. Use it to resume completed work instead of rebuilding it.
- Follow the approved `docs/requirements_review_and_execution_plan.md`, original PRD, and subsequent user decisions.
- Update `docs/PROGRESS.md` after each completed implementation step with changes, verification results, limitations, and the next step. Never mark an unverified milestone as complete.
- Keep focused Git commits. Track both npm and Cargo lockfiles; do not commit build output or personal frame sets.
- Preserve original source precision for pixel readout. Label any reduced-precision preview. Represent missing scene cells explicitly.
- Keep decoding, metrics, and file work off the UI thread. Discard stale results after scene or source changes.
- Use meaningful correctness tests for decoding, matching, coordinates, and stale work; visually verify the actual application when possible.
