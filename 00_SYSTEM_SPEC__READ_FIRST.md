# AGENT EXECUTION INSTRUCTIONS

You are building a single self-contained index.html file.

You MUST:
- Follow this specification exactly.
- Not simplify functionality.
- Not remove study logic.
- Not introduce external dependencies.
- Not split into multiple files.

Slides and notes are provided for reference only.
The architecture is defined in this document.



# ELI4110 Engineering Ethics – Intelligent Self-Testing Platform  
## Full System Specification for Claude Opus 4.6

---

# 1. PURPOSE

Build a **single-file offline HTML application** that functions as an adaptive, exam-oriented study engine for ELI4110 (Engineering Ethics).

The system must:

- Force structured legal reasoning (Issue → Rule → Application → Conclusion).
- Prioritize scenario application over passive memorization.
- Track weak doctrines (e.g., Reg 941 s.72 vs s.77 confusion).
- Implement spaced repetition tuned for rule-based learning.
- Simulate exam conditions (mixed module, time pressure, no hints).
- Operate entirely offline (single `index.html` file).
- Persist user state using `localStorage`.

This is not a flashcard app.  
It is a **legal reasoning drill engine**.

---

# 2. PEDAGOGICAL STRATEGY (MUST GUIDE IMPLEMENTATION)

This course is tested in three dominant patterns:

1. **Precise statutory citation**  
   (e.g., s.72 vs s.77, Industrial Exception trigger, Ron Engineering structure)

2. **Rule-based scenario reasoning**  
   (e.g., Conflict of Interest → s.72(2)(i) → disclose promptly)

3. **Distinguishing similar doctrines**
   - Misconduct vs Ethics
   - Simple vs Fundamental breach
   - Contract A vs B
   - Copyright vs Patent
   - Tort vs Contract liability
   - Consideration vs Gratuitous promise

The app must optimize for:

- Retrieval before exposure
- Scenario reasoning practice
- Mistake pattern reinforcement
- Rapid recall drills
- Statutory precision

---

# 3. ARCHITECTURE REQUIREMENTS

### Output
- Single file: `index.html`
- Inline CSS and JS only
- No external libraries
- No external calls
- Must run offline

---

# 4. DATA STRUCTURES

The system must support importing:

- Question Bank JSON
- Cloze deck JSON
- Markdown module summaries

---

## 4.1 Canonical Question Object

```js
{
  id: string,
  type: "mcq" | "multi_select" | "true_false" | "short_answer" | "cloze" | "scenario",
  difficulty: 1-5,
  tags: [string],
  prompt: string,
  choices: [string],
  answer: string | [string],
  explanation: string,
  source_refs: [string],
  rubric: [string]
}
```

---

## 4.2 User State Object

```js
{
  questionStats: {
    [questionId]: {
      ease: number,
      interval: number,
      due: timestamp,
      lapses: number,
      streak: number,
      lastAnswerCorrect: boolean
    }
  },
  analytics: {
    tagAccuracy: {},
    moduleAccuracy: {},
    typeAccuracy: {},
    doctrineConfusionPairs: {}
  },
  settings: {
    dailyNewLimit: number,
    examDefaultLength: number,
    spacedRepetitionEnabled: boolean
  }
}
```

---

# 5. CORE STUDY MODES

## MODE 1 — Daily Adaptive Queue

Spaced repetition engine (SM-2 inspired).

Algorithm:

- Default ease = 2.5
- Again → interval = 1 day
- Hard → interval × 1.2
- Good → interval × ease
- Easy → interval × (ease + 0.15)

Clamp ease 1.3–3.0

Due questions appear first.
Weak tags get priority boost.

---

## MODE 2 — Scenario Drill (MOST IMPORTANT)

### Structured Response Interface

User must answer in four fields:

1. Issue
2. Rule (must reference statute/doctrine)
3. Action
4. Justification

After submission:

- Reveal rubric
- Highlight missing rule elements
- Show correct statutory citation

Score rubric items individually.

---

## MODE 3 — Precision Recall Sprint

Rapid cloze/short answer only.

Timer optional.

Tracks hesitation button:
“I knew it but hesitated.”

Hesitation counts as soft-fail in spaced repetition.

---

## MODE 4 — Exam Simulation

User selects:

- # questions
- Module filters
- % scenario vs MCQ vs recall

Constraints:

- No explanations until submission.
- Timer visible.
- Final report must show:
  - Overall %
  - Accuracy by tag
  - Accuracy by doctrine
  - Most missed statutes
  - Common confusion patterns

---

## MODE 5 — Doctrine Weakness Drill

Automatically generated set of:

- Most missed tags
- Most lapsed spaced repetition cards
- Frequently confused doctrine pairs

Example auto-pairs:

- s.72 vs s.77
- Simple vs Fundamental breach
- Contract A vs Contract B
- Patent vs Copyright
- Tort vs Contract
- Misrepresentation vs Fraud

---

# 6. TEACH PANEL SYSTEM

Each question should display:

- Explanation
- Relevant Rule section
- Extracted summary content from Markdown

Teach panel sections must be collapsible:

- Definitions
- Elements
- Statute
- Case reference
- Exam trap note

---

# 7. ANALYTICS DASHBOARD

Must include:

- Daily streak
- Total questions answered
- Accuracy heatmap (calendar style)
- Weakest tags (top 10)
- Most missed statutes
- Confusion detection engine

Confusion detection logic:
If user answers both of two doctrine types incorrectly within 48h, mark as confusion cluster.

---

# 8. SEARCH FUNCTIONALITY

Search across:

- Question prompt
- Tags
- Explanations
- Case names
- Statute numbers

Instant filtering.

---

# 9. IMPORT / EXPORT

Allow:

- Import question bank JSON
- Import cloze JSON
- Import progress JSON
- Export progress JSON
- Export “missed only” JSON

---

# 10. QUESTION TYPE RENDERING

MCQ:
- Single select
- Instant correctness feedback optional

Multi-select:
- Must match full set exactly

Short answer:
- Normalize case
- Ignore punctuation
- Allow answer_variants

Cloze:
- Inline blanks

Scenario:
- Multi-field IRAC style

---

# 11. SPECIFIC COURSE LOGIC INTEGRATION

Priority weighting:

1. Reg 941 s.72 vs s.77
2. Ron Engineering structure
3. Negligence 3 elements
4. Contract 5 elements
5. Conflict of Interest disclosure standard
6. Industrial Exception trigger
7. Fundamental vs Simple breach
8. IP distinctions
9. Whistleblowing order
10. Standard of Care

These must have boosted recurrence weighting.

---

# 12. UI LAYOUT

Top navigation:

- Today
- Scenario Drill
- Precision Sprint
- Practice
- Exam Mode
- Analytics
- Import/Export
- Settings

Clean minimal layout.
Readable legal typography.
Dark mode toggle.

---

# 13. ACCEPTANCE TESTS

The system is complete when:

- Runs offline
- Imports JSON
- Persists progress
- Scenario rubric scoring works
- Spaced repetition updates due dates
- Exam mode calculates breakdown
- Confusion clusters appear
- Reset per-module works

---

# 14. OPTIONAL ADVANCED FEATURES (IF TIME)

- Tag network visualization
- Auto-generate new scenario variations
- Confidence tracking
- “Statute memory lock” mode (must type section number)

---

# 15. FINAL DELIVERABLE

Produce:

- Single `index.html`
- Fully self-contained
- With placeholder example data embedded
- Structured for easy injection of provided JSON

No explanations.
No commentary.
Only code.
