# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session Management Protocol
1. After you have successfully committed your changes and verified the task is complete, you MUST perform the following steps:
2. Provide a brief 1-sentence summary of what was done.
3. Output the text: `[TASK_COMPLETE] - Clearing session to save tokens.`
4. Immediately execute the command: `/clear`
5. Do not ask "Is there anything else?" or continue the conversation after clearing.


## Project Overview

Web-based block diagramming tool with support for nested blocks, connections, and proxy blocks that link to other diagrams (enabling recursive/hierarchical composition).

See [docs/cbdiag_prd.md](docs/cbdiag_prd.md) for product requirements.
