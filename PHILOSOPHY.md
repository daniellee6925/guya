# Creation Philosophy


## TL;DR

Most people are chasing the best setup. I think the thing worth chasing is the best *workflow* — and that only comes from looking honestly at what you specifically struggle with, what you specifically repeat, what you specifically want to get better at, and building toward that.

Use AI to improve your workflow. Don't bend your workflow to fit what other people's AI setups look like.

---


A personal AI coding harness. Built for one rider, by that rider.

> **Quick glossary** (so the rest reads smoothly):
> - **Claude Code** — Anthropic's command-line coding agent. You give it a task, it reads your repo and writes code.
> - **Harness** — the scaffolding *around* the model: the prompts, rules, tools, hooks, and workflows that shape how you actually use it. The model is the engine. The harness is everything else.
> - **Plugin** — in Claude Code, a bundle of commands, hooks, and tools you can install to extend the agent. Guya is a plugin.

---



## Why this exists

I've been using Claude Code passively for four months and actively for the last two weeks. Guya is what came out of that.

Most of the AI-coding discourse right now is about the harness — which tool, which setup, which MCP stack, which loop. Everyone's chasing the latest and best. I think that's one level too low.

Everyone is riding the same horse (Opus 4.6, the current flagship model). The rider is what differs.

Skill level, workflow, beliefs, the kind of work you actually do day-to-day — none of that is shared. So a harness that works for Karpathy is basically dangerous for me. If I tried to use his setup I'd spend all my energy trying not to fall off. A newbie rider on an expert's harness has no harness at all.

The move isn't to copy someone else's setup. It's to build one that fits *you* — your level, your weaknesses, the tasks you actually repeat, the decisions you actually struggle with.

## The thing I figured out about myself

I used to rely heavily on a planning loop (tools called **ralplan** and **ralph** from the OMC plugin — ralplan iterates on a plan with the model, ralph executes it). The flow was: write a short prompt, let ralplan turn it into a detailed plan over several rounds, let ralph implement it. On paper it's beautiful.

In practice, the output was still trash, and for a while I couldn't figure out why.

Eventually I saw it: my initial prompt was the problem. I'd write something like *"add feature xyz, refer to the codebase for details"* and expect the loop to fix it. It can't. If the starting direction is wrong or vague, iterating just gets you to a more polished version of the wrong thing.

And the reason my prompts were bad wasn't laziness — it was that I didn't know enough to write good ones. I usually know *what* I want, not *how* to implement it or *why* it should be done a particular way. So I'd hand the decision off to Claude and let it teach me after the fact.

That was my biggest flaw. The harness is supposed to come from the rider making decisions and guiding the LLM. I was doing the opposite — letting the LLM decide and following along.

## Why this had to become a plugin

The obvious response here is: "okay, just write better prompts, think harder before you start." Sure. But discipline doesn't survive across sessions. I forget. I get lazy. I slide back into handing decisions off because it's easier.

A habit that requires me to remember it every time is a habit that fails. A system that forces it is a system that works.

That's what Guya is. Not a tool to make Claude more powerful — Claude is already plenty powerful. A tool that makes *me* a better rider, across every session, whether I feel like thinking hard that day or not.

## Other places I kept failing

The ralplan thing was the origin story, but once I started paying attention, I saw the same pattern in other places — small failures I kept repeating because nothing in my setup was forcing me not to.

**Session amnesia.** Every new session with Claude started with me re-explaining who I am, what project this is, how I like to be talked to, what I was working on yesterday. I'd paste the same context blurb, restate the same preferences, re-describe the same architecture. Pure tax, every single time. And sometimes I'd forget a piece and the session would go sideways for half an hour before I caught it.

*Guya's fix:* a session-start hook that assembles my identity, user profile, project state, and last-session context automatically, before I type the first message. The session starts warm.

**Lessons dying with the session.** I'd figure something real out mid-session — "oh, I should stop generalizing about my habits from one project, I work across SDF, Guya, and BosonAI" — and lose it the moment the window closed. Next session, same mistake. The intelligence was accumulating inside a single conversation and then vaporizing.

*Guya's fix:* `/guya-reflect` at the end of a session writes down what happened. `/guya-evolve` reads accumulated reflections and proposes updates to Guya's own guidelines. I review, approve, and the next session actually behaves differently. The realization becomes permanent instead of evaporating.

Different failures, same underlying shape: I know the right thing, I don't do the right thing, I need a system that makes the wrong thing harder than the right thing.

## What a session actually looks like

Before Guya, starting a feature looked like:

> **Me:** add a retry layer to the API client
>
> **Claude:** *writes 200 lines*
>
> **Me:** okay cool, commit it
>
> *(three days later I'm debugging why it retries on 4xx errors)*

With Guya, it looks like:

> **Me:** `/guya-decision-feature` add a retry layer to the API client
>
> **Guya:** What's the scope — which calls, which error classes? What's out of scope? What does success look like? What's the blast radius if this is wrong?
>
> **Me:** *stuck for a minute, then actually answers*
>
> **Guya:** Okay, here are three approaches with tradeoffs. You pick.
>
> **Me:** *picks one, now actually understands why*
>
> **Claude:** *writes the code*

Same model. Same repo. The difference is that I thought before Claude typed. That's the whole product.

## What it actually does differently

- **Forces the decision onto me.** The decision harnesses (`kickoff`, `feature`, `bugfix`, `refactor`) make me state scope, constraints, and success criteria before any plan gets written. Claude is the advisor, not the decider. I hate it sometimes. That's the point.
- **Accumulates a model of me.** A user profile, a growth tracker, and a set of guidelines that come from watching how I actually work. Over time the harness fits better because it knows more about the rider it's on.
- **Evolves from reflection.** After sessions I write a short reflection on what went well and what didn't. The system reads those reflections and proposes updates to its own behavior. I review, approve, and the applied changes show up in the next session automatically. The personalization compounds instead of evaporating.
- **Grows the rider, not just compensates for one.** This is the part I care most about. A harness that just papers over my weaknesses turns into a crutch. The growth tracker watches specific areas I'm trying to improve (code review, architecture, debugging from first principles) so the system knows which parts of me are supposed to need less scaffolding over time, not more.

## The mental model underneath all this

Zoom out for a second. Claude Code is essentially a big wrapper that assembles a prompt and sends it to an LLM. The LLM itself is stateless. Imagine waking up every morning with zero memory of who you are, what you were working on, or what you figured out yesterday — that's the model on every call. The whole game is helping it recover the relevant memory as efficiently as possible.

That game has three moving parts, and everything in Guya is built on top of them.

**Context management.** The model only knows what it sees in the prompt. Your job is to show it exactly what it needs — and *only* what it needs. Dumping the whole codebase in is as bad as dumping nothing; the signal gets drowned. Less context, better results.

**Memory.** If you had to re-supply the same context every session, that'd be exhausting and you'd stop doing it. Memory is what lets you reconstruct the right context without explicitly staging it every time. Identity files, user profile, archived project history, guidelines — these exist so the relevant pieces are already available when a session starts.

**Planning.** The model's context window is bounded. Like a human who can't cram 100 pages into one night, the model can't hold a whole project at once. Planning is how you decide *which slice of context shows up at which stage of the work*. Break the work down, feed the model the right slice for each step, and the output at each step is sharper.

All three are really the same idea from different angles: **externalize state, and surface the right piece at the right time.** The LLM is an open-book test-taker. It doesn't need to have memorized the book. It needs to know where to look. Most of what Guya does — session-start context assembly, reflections turning into guidelines, STATUS.md auto-updated after commits, archival memory searchable per project — is about making that lookup fast and correct.

And that's why Guya is built mostly out of three primitives:

- **Agents** — when you need a specialized context for one kind of work. Different agent, different system prompt, different tools.
- **Skills** — when you do the same task over and over and want it reliable. A skill is a playbook the model follows.
- **Hooks** — when the task should happen *automatically*, without you remembering to invoke it. Session start, pre-commit, post-commit, session end. The things you don't want to depend on discipline for.

Agents for isolation. Skills for repeatability. Hooks for things that have to happen whether you feel like it or not.



## Don't blindly adapt yourself to AI — see how AI can adapt to you too.


