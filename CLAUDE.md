# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session Management Protocol
1. When starting new work, if you are in the main branch create a new branch instead.
2. When all done with the work, you can commit changes in the branch. You can even do multiple changes in the branch
3. When done with the initial task, push the branch to github using `git push -u origin` the first time. Also create a PR.
4. I'll review the code in the PR. If there are issues, pay attention to those and correct locally. This may involve paying attention to github PR reviews.
5. After approved, do a squash commit in github.
6. After you have successfully committed your changes and verified the task is complete, you MUST perform the following steps:
7. Provide a brief 1-sentence summary of what was done.
8. Output the text: `[TASK_COMPLETE] - Clearing session to save tokens.`
9. Immediately execute the command: `/clear`
10. Do not ask "Is there anything else?" or continue the conversation after clearing.


## Project Overview

Web-based block diagramming tool with support for nested blocks, connections, and proxy blocks that link to other diagrams (enabling recursive/hierarchical composition).

See [docs/cbdiag_prd.md](docs/cbdiag_prd.md) for product requirements.
