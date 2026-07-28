# Chiri Engineering Assessment — AI Document Editor

## The Challenge

Build a **collaborative AI document editor** in the browser.

The user writes **Markdown**, and an AI agent works alongside them—suggesting edits, showing diffs, and iterating on the document together.

> **Note:** You do **not** need to build a full Markdown editor from scratch. Using a prebuilt editor such as **Tiptap** (or a similar solution) is perfectly fine.

Think of it as **Google Docs meets AI pair-writing**.

The user is always in control, but the AI acts as a capable collaborator that can:

- Rewrite paragraphs
- Fix tone
- Restructure sections
- Follow specific instructions

---

# What to Build

Create a **single-page web application** (no authentication required) where:

1. The user can write and edit **Markdown** in a browser-based editor.
2. An AI agent can suggest changes to the document (or a selected portion).
3. Suggestions appear as **visible diffs**, allowing the user to clearly see what the AI wants to change before accepting.
4. The user can:
   - Accept suggestions
   - Reject suggestions
   - Refine suggestions
5. The overall experience should feel **collaborative**—like working with a smart co-author, **not**:
   - a chatbot living in a sidebar, nor
   - an AI that simply rewrites the entire document.

Beyond these requirements, the design is entirely up to you.

> We're intentionally leaving this open-ended. How you interpret **"collaborative editing with AI"** tells us a lot.

---

# What We Provide

- ✅ An **OpenRouter API key**
- 💰 A **$5 spending cap**
- 🤖 You may use **any model available through OpenRouter**

That's it.

The rest is up to you.

---

# What to Submit

## 1. Source Code

Host your project on **GitHub** or **GitLab** and send us the repository link.

---

## 2. README

Include a README containing:

- How to run the project
- What you built
- What you would do differently with more time

---

## 3. AI Session History (Required)

Save your AI session(s).

We want to understand **how you used AI during development**.

Examples:

- Claude transcript
- Cursor Composer history
- ChatGPT conversation
- Any other AI workflow history

> **This is not optional.**

Please commit these transcripts alongside the project code in the repository.

---

# What We Evaluate

| Evaluation Area | What We Look For |
|-----------------|------------------|
| **The experience** | Is it intuitive? Can we open it, write something, and receive useful AI suggestions without reading documentation? |
| **AI integration quality** | Does the AI feel like a real collaborator rather than a gimmick? Are the diffs clear and genuinely useful? |
| **How you used AI to build it** | Did you use AI effectively to move faster? Can you explain the decisions you made? |
| **Code quality** | Is the code organized, readable, maintainable, and easy for another engineer to understand? |
| **Taste & judgment** | What did you prioritize? What did you intentionally leave out? Thoughtful trade-offs matter more than feature count. |

---

# What We Don't Care About

Please don't spend time adding unnecessary infrastructure.

Specifically, we're **not** evaluating:

- Docker
- Databases
- Authentication systems

This is meant to be a simple showcase that allows us to evaluate your AI-assisted engineering workflow.

We're also **not** looking for:

- Pixel-perfect UI (although it should be usable and not broken)
- Any specific framework

Use whatever helps you move quickly:

- React
- Vue
- Svelte
- Vanilla JavaScript
- Anything else you're comfortable with

---

# Guidelines

### Time

Spend whatever feels appropriate.

This should be **fun**, not a grind.

> A focused **4–6 hour session** is better than a sprawling weekend project.

---

### AI Usage

AI usage is **required**, not merely encouraged.

We use AI every day in our engineering workflow, and we'd like to see how you do the same.

Please:

- Use Claude, Cursor, Copilot, ChatGPT, or any AI tool while building the project.
- Save the session or transcript.
- Include it in the repository so we can review it alongside your code.

---

# Ideas (Not Requirements)

These are simply ideas to inspire you.

Build whichever version excites you most.

- ✨ Inline suggestions displayed as tracked changes
- ⌨️ Command palette or slash commands for AI actions
- 🔀 Split-pane diff view (before / after)
- 📝 "Rewrite this section in a different tone" with a live preview
- 🕒 Version history showing how the document evolved with AI assistance
- 🔄 Multi-turn refinement such as:
  - "Make it shorter"
  - "Now make it more formal"
  - "Add examples"
