---
name: guya-scout
description: >
  Codebase onboarding skill. Use whenever Daniel opens or is handed a new codebase and needs to understand it — not just what files exist, but how the system works, what it's built around, and what the components do. Trigger on: "scout this", "walk me through this codebase", "explain this repo", "onboard me to X", "what is this project", "help me understand this code". Also trigger proactively when Daniel is about to work in an unfamiliar project. Generates a report.md and runs a bidirectional interactive session.
---

# guya-scout

Onboard Daniel into a new codebase efficiently. High-level first, details second.

Two phases:
1. **Exploration** — spawn an Explore subagent to read the codebase and generate `report.md`
2. **Interactive session** — bidirectional Q&A: Guya quizzes Daniel, Daniel asks questions

---

## Phase 1: Exploration

### Setup

Determine the target directory:
- If Daniel specified a path, use that
- Otherwise use the git root (`git rev-parse --show-toplevel`) or CWD

Output file: `<target-dir>/scout-report.md`

### Spawn the Explore subagent

The Explore subagent is low-token and read-only — it uses AST parsing and targeted searches rather than reading every file. Give it a focused mission so it doesn't waste tokens on irrelevant detail.

Prompt the Explore subagent with:

```
You are scouting a codebase for a developer who needs to understand it quickly.
Target directory: <path>

Your goal: produce a structured report with these sections. Be concise — one paragraph per section, no fluff.

**1. What Is This?**
One sentence: what does this program do and who uses it?

**2. Directory Map**
A tree of the top-level structure with one-line inline comments on each significant directory and file. Don't list every file — annotate the ones that matter. Format as a code block. Also include any external directories (e.g. ~/.config/foo) that are part of the system.

**3. System Architecture**
How does the system work at a high level? What are the main layers/subsystems? How does data flow through the system from input to output? What are the key entry points (main files, CLI commands, API endpoints)?

**4. Design Philosophy**
What are the core beliefs behind how this was built? Look for: README, CLAUDE.md, ADR files, comments at the top of major files, naming conventions, folder structure choices. Extract the "why" behind the architecture, not just the "what".

**5. Component Catalog**
List every major module/package/directory with a one-line description of what it does and what it owns. Format as a table: | Component | Path | Responsibility |

**6. Key Files**
The 5-10 files a developer should read first to understand the system. Why each one matters.

**7. Non-Obvious Things**
What would surprise a developer coming from a different codebase? Quirks, conventions, gotchas. Include known bugs or TODO items if they're visible in comments or STATUS files.

**8. Where to Start**
Group entry points by goal. Format as: "If you want to understand X, read: file1, file2, file3." Cover the 3-5 most common "I need to understand..." questions a new developer would have.

Write this as markdown. Be specific — cite actual file names, function names, config keys. Don't pad.
```

### Post-processing

When the Explore subagent returns:
1. Write its output to `scout-report.md` at the target directory
2. Tell Daniel: "Report written to `scout-report.md`. Read it, then come back and we'll start the session. Type `ready` when you're done."
3. Wait for Daniel to respond before starting Phase 2.

---

## Phase 2: Interactive Session

This is bidirectional. Two modes run simultaneously:

- **Guya quizzes Daniel** — comprehension questions to surface gaps
- **Daniel asks questions** — Guya answers from what it learned in Phase 1

### How to run the session

Start by saying: "Let's test your understanding. I'll ask questions — answer what you know, skip what you don't. You can ask your own questions anytime, just throw them in."

Then ask comprehension questions one at a time. Generate 5-8 questions from the report, ordered from architectural (easy, high-level) to detailed (harder, implementation-specific). Don't dump all questions at once — ask one, wait, respond, ask the next.

**Good question types:**
- "Where does X happen in this codebase?" (forces navigation knowledge)
- "If you needed to add feature Y, where would you start?" (forces architectural understanding)
- "What's the difference between X and Y here?" (forces component distinction)
- "What would break if you removed Z?" (forces dependency understanding)
- "Why does this use approach A instead of the more common approach B?" (forces design philosophy)

**After Daniel answers:**
- If correct: confirm briefly + add one non-obvious detail they might not know
- If partially correct: fill the gap specifically — not "good try", but "you got X right, you missed Y"
- If wrong: explain the correct answer directly, no softening

**When Daniel asks a question:**
Treat it as the highest priority. Answer it immediately from what the Explore subagent found. If the answer isn't in the report, say so and offer to dig deeper (spawn another Explore pass if needed).

### Session end

End when Daniel says "done", "I'm good", "that's enough", or similar. Summarize what they know well and what's worth revisiting: "Strong on architecture, fuzzier on the data layer — worth reading `<file>` when you get a chance."

---

## Notes

- The Explore subagent reads, never writes. It won't touch the codebase.
- `scout-report.md` is the persistent artifact — Daniel can re-read it later without re-running the skill.
- If the codebase is very large (>500 files), tell the Explore subagent to focus on the top-level structure and representative samples rather than exhaustive coverage.
- Don't quiz Daniel on trivia (line numbers, variable names). Quiz on concepts, flows, and architecture.
