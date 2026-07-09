@AGENTS.md
## Auto-commit rule
After every meaningful change, automatically run:
git add -a && git commit -m "<brief description of what changed>" && git push

Commit after every file save or logical change — don't batch multiple unrelated changes into one commit. Each commit message should describe what specifically changed in plain English.

## Commit message format
`[component] what changed` 

Examples:
- `[system prompt] fix Checklist 1 must-haves, remove RSI divergence`
- `[verdict] fix setup detection logic for beaten down stocks`
- `[ui] add OBV pattern label to detail view`
- `[data] add obv_history and rsi_history arrays to Claude API payload`