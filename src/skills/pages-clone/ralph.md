---
description: Starts the Ralph Autonomous Agent Loop. Iterates through prd.json, implementing, testing, and committing one micro-task at a time. Triggered implicitly if the user asks to "iniciar modo trator", "executar o protótipo", or runs /ralph.
---

# 🚜 Workflow: The Ralph Loop (`/ralph`)

**Prerequisite:** Ensure a valid `prd.json` exists. If it doesn't, guide the user to create one first by gathering requirements and generating granular micro-tasks using the `autonomous-ralph` skill.

## 🤝 Transparência e Feedback (Regra de Ouro)

- **Sem Silêncio:** NUNCA execute tarefas longas sem dar um sinal de vida. Informe o que está fazendo a cada iteração importante.
- **Relate Falhas:** Se um comando falhar, um site bloquear o acesso ou ocorrer um erro inesperado, avise o usuário IMEDIATAMENTE. Explique o que falhou e o que você planeja tentar em seguida.
- **Peça Ajuda:** Se você perceber que está "andando em círculos" (tentando a mesma coisa 2-3 vezes sem sucesso), pare e peça orientação ao usuário.

## Execution Steps

### 1. Initialization

- Read `prd.json`.
- Read `progress.txt` (if it exists, specifically the *Codebase Patterns* section).
- Check the Git branch. Ensure we are on the branch specified in `prd.json`. If not, create and checkout the branch.

### 2. The Iteration Loop (Execute one task per turn)

For the current iteration, perform the following for the pending user story (the one with the highest priority where `passes: false`):

1. **Implement**: Write the code to fulfill the specific User Story. Do NOT do more than what is asked.
2. **Quality Check**: Run appropriate checks (e.g., `python .agent/scripts/checklist.py .` or specific test commands).
3. **Extract Learnings**: If any architectural rules, gotchas, or reusable patterns were discovered, prepend them to the `## Codebase Patterns` section in `progress.txt`.
4. **Commit & Update**:
   - Stage and commit the changes: `git add . && git commit -m "feat: [Story ID] - [Title]"`
   - Update `prd.json`, setting `passes: true` for this story.
   - Append a progress log to `progress.txt` noting the files changed and what was learned.
5. **Report & Prompt Next**: Show the user the result of this iteration and ask if you should proceed to the next pending story.

### 3. Completion

- Once all stories in `prd.json` are `passes: true`, output:
  `<promise>COMPLETE</promise>`
- Inform the user that the feature is complete and ready for pull request or deployment.
