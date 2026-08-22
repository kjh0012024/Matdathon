# AGENTS.md

## Project intent

This project builds **에이전트A+**, a web app that helps university students prepare for exams by turning lecture slides, lecture audio, and optional past exams into annotated study material.

## Agent operating rules

When implementing this project, coding agents should:

1. Prefer the smallest change that fully satisfies the requirement.
2. Keep PRD, TRD, and implementation consistent.
3. Preserve the existing product scope unless the user explicitly changes it.
4. Treat PRD as the source of product truth, TRD as the source of technical truth, and AGENTS as the source of execution rules.
5. Make the app work as a web app first; do not introduce mobile apps or LMS integrations unless requested.
6. Keep the architecture aligned with the TRD.
7. Use Azure for deployment-related decisions.
8. Use Copilot SDK for agent orchestration.
9. Treat uploaded exam papers as higher-priority signals than course reviews.
10. When PRD and TRD appear to conflict, stop and ask for clarification instead of guessing.

## Product scope guardrails

### In scope
- Anonymous web usage
- Slide/PDF upload
- Audio upload
- Exam-paper upload or pasted text
- Async processing
- Slide-to-transcript alignment
- Annotated PDF study packet generation
- Job progress and failure states
- Later-phase web quiz and explanation UI for predicted exam questions

### Out of scope unless explicitly requested
- School LMS integration
- Live lecture capture
- Guaranteed exam prediction
- Full automated study planning
- Native mobile apps

## Implementation priorities

1. Make upload and async processing work end-to-end.
2. Make slide/audio matching reliable enough for the demo.
3. Generate a usable annotated PDF.
4. Support exam-paper input and use it as a high-priority signal.
5. Keep the UI clear about progress, success, and failure.
6. Leave the exam-question web practice and explanation UI for a later phase unless explicitly requested.

## Engineering rules

- Prefer clear, modular code over clever code.
- Keep file storage, queueing, and persistence outside Copilot SDK responsibilities.
- Surface errors with the failing stage and retry guidance.
- Preserve successful intermediate artifacts when possible.
- Do not add broad fallback behavior that hides failures.

## Data and privacy

- Keep user-uploaded files and generated outputs until the user deletes them.
- Support explicit deletion of files and outputs.
- Assume minimal-cost Azure infrastructure unless the user requests otherwise.

## Documentation rules

- Update PRD when product scope changes.
- Update TRD when technical architecture changes.
- Keep README or setup docs aligned with the actual implementation if they exist.

## Verification expectations

- Verify the upload flow.
- Verify async job progress.
- Verify PDF generation.
- Verify exam-paper input handling.
- Verify that the PDF output matches the PRD before adding later-phase practice features.
- Verify that the app still matches the current PRD/TRD after changes.
