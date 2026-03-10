# 📋 Workflow Completo - Criação de Landing Pages

## 🚀 Visão Geral

Este documento descreve o fluxo completo para criar landing pages de afiliados, desde o input até o projeto pronto.

---

## 🔄 Fluxo de Execução

```
INPUT DO USUÁRIO        ANÁLISE              EXECUÇÃO              PROJETO PRONTO
   (info)          →   (extrair)      →   (Ralph Loop)      →   (pasta ready)
```

### Etapas:

1. **Input:** Informações brutas do produto
2. **Análise:** Extrair país, idioma, moeda, benefícios
3. **Execução:** Ralph Loop executa tasks
4. **Entrega:** Projeto pronto

---

## 📊 Estrutura de Arquivos

```
pages-clone/
├── ralph.md                    ← Agente Loop (NÃO MODIFICAR)
├── docs/
│   ├── 01-workflow.md          ← Este arquivo
│   ├── 02-guide.md             ← Guia técnico completo
│   └── 03-skills.md            ← Todas as skills
├── templates/
│   ├── prd.json               ← Template requisitos
│   └── progress.txt           ← Template progresso
└── examples/
    └── [projeto]-offer/        ← Exemplos prontos
```

---

## 🎯 Como Iniciar Novo Projeto

### Step 1: Fornecer Informações

Basta me dar:
- Nome do produto
- País/Idioma
- Link de affiliate
- Benefícios
- Preço

### Step 2: Análise Automática

Eu vou:
1. Extrair informações relevantes
2. Definir país → idioma → moeda
3. Definir cores (padrão: Verde Natureza #059669)
4. Criar prd.json

### Step 3: Execução

Ralph Loop executa as tasks em paralelo:
- Task 001: Estrutura de pastas
- Task 002: Gerar HTML
- Task 003: SEO + Docs
- Task 004: Validação

### Step 4: Projeto Pronto

```
[produto]-offer/
├── index.html
├── README.md
├── prd.json
└── images/
```

---

## ⏱️ Tempo Estimado

| Fase | Tempo |
|------|-------|
| Análise | ~30s |
| Execução | ~2min |
| **Total** | **~2-3 min** |

---

## 📖 Referências

- **Guia Técnico:** `docs/02-guide.md`
- **Skills:** `docs/03-skills.md`
- **Page Analyzer:** `docs/04-page-analyzer.md`
- **Ralph:** `ralph.md`
