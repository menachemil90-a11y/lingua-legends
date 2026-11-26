# Bagrut Academy — Israeli 5-unit English preparation

**Independent preparation material. Not an official Ministry of Education (MoE) product.** The UI says so on the Academy screen.

## Verification status: UNVERIFIED DRAFT
The exam structure lives in `packages/content/src/bagrut.ts` (`BAGRUT_CURRICULUM`) and is marked
`verification: 'unverified-draft'`. During development the official booklet could not be downloaded
(network restriction), so **no claim of alignment with a specific exam year is made**.

Official reference: <https://meyda.education.gov.il/files/pop/0files/english/Chativa-Elyona/Bagrut/updates/5pointsbooklet2025.pdf>
CEFR reference: <https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-companion-volume-and-its-language-versions>

To verify (see HANDOFF.md §7): compare components, timings, weights, task types, word counts and literature
requirements with the booklet for the target year; update `BAGRUT_CURRICULUM`, `MOCK_EXAMS` and task `wordRange`s;
set `verification: 'verified'` and `verifiedAgainst`. 5-unit English is **not** mapped to a single CEFR level.

## Configurable structure
```ts
CurriculumConfig { id, label, verification, verifiedAgainst, components: BagrutComponent[] }
BagrutComponent { id: 'module-e' | 'module-f' | 'module-g' | 'cobe' | 'project', name, nameHe, focus[], passageIds[], itemTags[], taskIds[] }
```
Several curriculum versions can coexist (add another `CurriculumConfig`).

## Components and current material (all original)
| Component | Material |
| --- | --- |
| Module E | "Why We Forget — and How to Remember" (B1), "The Library That Refused to Close" (B2): MC comprehension, vocabulary in context, 2 open questions with example answers |
| Module F — Literature | Original poem "Lanterns" and short story "The Last Ferry": MC inference items, HOTS task (explaining patterns), character analysis, bridging-text task |
| Module G | "The Hidden Cost of Convenience" (C1 opinion article): inference/argument items, vocabulary in context, argumentative essay, opinion essay, paragraph builder |
| COBE (oral) | 6 prompts: personal responses ×2, spontaneous ×2, project presentation, audio response (browser text-to-speech reads an original news script) with prep/speaking timers and self-check lists |
| Project | Project planner (research question, sources, product) |
| Mock exams | Module E (40 min) and Module G (60 min) practice exams — durations are configurable, not claimed to match the real exam |

Progress is tracked separately per component (completed tasks, best mock scores).

## Content limitations
- No copyrighted exam passages are used; all texts were written for this project and are AI-drafted pending teacher review.
- Writing and speaking are **self-assessed** with checklists. There is no automatic grading, no AI feedback and no speech
  recognition until a provider is approved (HANDOFF.md §6). Any future AI feedback must be labelled advisory, never an official grade.
- Volume is a starter set; a real preparation course needs many more unseen passages per level and literature pieces from the official reading list (licensed appropriately).
