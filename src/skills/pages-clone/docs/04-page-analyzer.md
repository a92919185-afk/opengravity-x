# 🔍 Skill: Page Analyzer

> **Trigger:** "analisar página", "extrair cores", "analisar design", "pegar cores da página"

## Descrição

Esta skill analisa uma URL fornecida pelo usuário e extrai informações sobre:
- Fontes utilizadas
- Cores principais
- Layout e estrutura
- Componentes

## Fluxo de Execução

### 1. Receber URL
O usuário fornece: `https://exemplo.com`

### 2. Baixar HTML
Usar `webfetch` para obter o código completo:
```
webfetch format=html url=[URL]
```

### 3. Analisar Elementos

#### 3.1 Fontes
Procurar no código:
```html
<link href="fonts.googleapis.com...">
<link href="fonts.gstatic.com...">
```
Identificar: Font-family, weights

#### 3.2 Cores
Procurar:
- Classes Tailwind: `bg-red-500`, `text-blue-600`
- Cores hex: `#d32f2f`, `#059669`
- CSS inline: `style="color: #..."`
- Variáveis CSS: `--primary`

#### 3.3 Layout
Identificar seções:
- Hero
- Navbar
- Features
- Reviews
- FAQ
- Footer

#### 3.4 Componentes
- Sticky CTA
- Modals
- Accordions
- Trust badges

### 4. Criar Relatório

Gerar output:
```
=== ANÁLISE DA PÁGINA ===

🔤 FONTES ENCONTRADAS:
- Inter (Google Fonts)
- Bodoni Moda (Serif)

🎨 CORES IDENTIFICADAS:
- Primary: #059669 (verde)
- CTA: #22c55e (verde claro)
- Dark: #1f2937 (cinza escuro)

📐 ESTRUTURA:
- 9+ seções
- Layout híbrido (mobile/desktop)
- Hero com accent lateral

🔧 COMPONENTES:
- Sticky CTA mobile
- FAQ accordion
- Modais
```

### 5. Perguntar ao Usuário

Após análise, perguntar:
```
Estas informações estão corretas?
Quer usar estas cores como base para o projeto?
```

## Input Exemplo

```
Analisar: https://visovo-ro.vercel.app/
```

## Output

Relatório detalhado com:
- Fontes identificadas
- Cores extraídas
- Estrutura identificada
- Componentes encontrados

## Após Análise

Usar as informações para:
1. Criar prd.json com cores extraídas
2. Configurar tailwind.config
3. Criar layout similar

---

## Ver Também

- Workflow: `01-workflow.md`
- Guia: `02-guide.md`
- Skills: `03-skills.md`
