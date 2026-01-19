# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session Management Protocol
1. When starting new work, if you are in the main branch create a new branch instead.
2. When all done with the work, you can commit changes in the branch. You can even do multiple changes in the branch
3. When done with the initial task, push the branch to github using `git push -u origin` the first time. Also create a PR.
4. I'll review the code in the PR. If there are issues, pay attention to those and correct locally. This may involve paying attention to github PR reviews.
5. After approved, do a squash commit in github.2
6. After you have successfully committed your changes and verified the task is complete, you MUST perform the following steps:
7. Provide a brief 1-sentence summary of what was done.
8. Output the text: `[TASK_COMPLETE] - Clearing session to save tokens.`
9. Immediately clear context - this is not running `/clear` in the bash environment but `/clear` in claude code.
10. Do not ask "Is there anything else?" or continue the conversation after clearing.

# Git Workflow Instructions: Worktrees

## Context
This project utilizes **Git Worktrees** instead of traditional `git checkout` for managing multiple branches. This allows for concurrent development, easier context switching, and prevents the need for `git stash`.

## Core Instructions
When suggesting Git commands or performing file operations, follow these rules:

### 1. Avoid Branch Switching in the Main Directory
- Do NOT suggest `git checkout <branch>` or `git switch <branch>` within an active worktree.
- Instead, suggest creating a new worktree for new features or fixes.

### 2. Worktree Creation Pattern
- **Command:** `git worktree add ../<folder-name> <branch-name>`
- **Location:** Worktrees should be created as sibling directories to the main repository folder to keep the project structure clean.

### 3. Cleanup Protocol
- When a task is complete and the branch is merged, remind the user to prune the worktree:
  - `git worktree remove <path-to-worktree>`
  - `git branch -d <branch-name>`

### 4. Path Awareness
- Be mindful that dependencies (like `node_modules` or virtual environments) may need to be re-installed or linked in the new worktree directory.
- If the user asks for a file search, clarify if they want to search across all active worktrees or just the current one.

## Command Reference for Claude
* **List active worktrees:** `git worktree list`
* **Add new worktree:** `git worktree add ../repo-feature-name feature-branch`
* **Remove worktree:** `git worktree remove ../repo-feature-name`

## Project Overview

Web-based block diagramming tool with support for nested blocks, connections, and proxy blocks that link to other diagrams (enabling recursive/hierarchical composition).

See [docs/cbdiag_prd.md](docs/cbdiag_prd.md) for product requirements.
