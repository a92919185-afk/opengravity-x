# 🎯 Skills - Documentação dos Agentes

> Este arquivo contém todas as skills para criação de landing pages.

---

## 📋 Índice

1. [Page Analyzer](#1-page-analyzer)
2. [Autonomous Offer Skill](#2-autonomous-offer-skill)
3. [HTML Generator Agent](#3-html-generator-agent)
4. [SEO Optimizer Agent](#4-seo-optimizer-agent)
5. [Validator Agent](#5-validator-agent)

---

## 1. Page Analyzer

**Trigger:** "analisar página", "extrair cores", "analisar design"

### Descrição
Analisa uma URL e extrai fontes, cores, layout e componentes.

### Como Usar
```
Analisar: https://exemplo.com
```

### Processo
1. Baixar HTML com webfetch
2. Identificar fontes (Google Fonts)
3. Extrair cores (hex, tailwind)
4. Mapear estrutura (seções)
5. Criar relatório

### Output
```
🔤 Fontes: Inter, Bodoni Moda
🎨 Cores: #059669 (primary), #22c55e (cta)
📐 Layout: 9+ seções, modelo Sema7
```

---

## 2. Autonomous Offer Skill

**Trigger:** "criar página", "novo projeto", "fazer landing page"

### Descrição
Inicia o processo completo de criação de uma landing page.

### Fluxo
1. Receber informações do produto
2. Extrair país, idioma, moeda, benefícios
3. Se faltarem informações → perguntar
4. Se cores não informadas → usar padrão (Verde #059669)
5. Criar prd.json
6. Iniciar Ralph Loop

### Input Exemplo
```
Produto: Visovo
País: Romênia
Link: https://tl-track.com/tracker/vXs9/
Benefícios: elimina oboseala, previne glaucoma
Preço: 111 RON
```

---

## 2. HTML Generator Agent

**Trigger:** Task "Gerar HTML completo" ativa

### Descrição
Gera o código HTML completo seguindo o modelo Sema7.

### Entrada
```json
{
  "project": "visovo-offer",
  "country": "Romênia",
  "language": "ro",
  "currency": "RON",
  "brandColors": { "primary": "#059669", "cta": "#22c55e" },
  "affiliateLinks": { "main": "https://..." }
}
```

### Tarefas

#### 2.1 Criar Estrutura
```
[produto]-offer/
├── index.html
├── README.md
└── images/
```

#### 2.2 Gerar index.html

**Head:**
- Meta tags
- Tailwind CSS CDN
- FontAwesome 6.4.0
- Google Fonts (Inter)
- Tailwind config com cores
- CSS styles (btn-cta, feature-card, modal, faq)
- JSON-LD (Product, FAQPage, WebSite)

**Body (9+ Seções):**

1. **Alert Bar** - Valores (frete, garantia, natural)
2. **Navbar** - Logo, links, CTA
3. **Hero** - Modelo Sema7 com accent lateral
4. **Trust Strip** - 4 ícones
5. **Prova Social** - 4 métricas
6. **Benefícios** - Texto
7. **Features Grid** - 6 cards
8. **Reviews** - 3 depoimentos + estatísticas
9. **FAQ** - 7 perguntas accordion
10. **SEO Text** - Parágrafos
11. **Footer** - Links + modais + disclaimer
12. **CTA Sticky Mobile**

### Regras
- ✅ Sempre modelo Sema7
- ✅ Sempre cores do prd.json
- ✅ Sempre 9+ seções
- ✅ Sempre idioma correto

---

## 3. SEO Optimizer Agent

**Trigger:** Task "Otimizar SEO" ativa

### Descrição
Adiciona e otimiza todas as tags de SEO, Open Graph e JSON-LD.

### Meta Tags
```html
<title>[Produto] | [Benefício] (2025)</title>
<meta name="description" content="[130-155 chars]">
<meta name="keywords" content="[keywords]">
<meta name="robots" content="index, follow">
<meta name="geo.region" content="[PAÍS-ISO]">
<link rel="canonical" href="...">
<link rel="alternate" hreflang="[LANG]" href="...">
```

### Open Graph
```html
<meta property="og:type" content="product">
<meta property="og:title" content="...">
<meta property="og:description" content="...">
<meta property="og:image" content="images/hero.webp">
```

### JSON-LD

**Product:**
- name, description, brand, image, url
- offers (priceCurrency, price, availability)
- aggregateRating (ratingValue, reviewCount)
- review (2+ reviews)

**FAQPage:**
- 7 perguntas iguais ao FAQ visual

**WebSite:**
- name, url

---

## 4. Validator Agent

**Trigger:** Task "Validação final" ativa

### Checklist

#### Estrutura
- [ ] Pasta [projeto]-offer/ existe
- [ ] index.html existe
- [ ] README.md existe
- [ ] images/ existe

#### HTML/Layout
- [ ] Modelo Sema7
- [ ] 9+ seções
- [ ] Hero com accent decorativo
- [ ] Layout híbrido mobile/desktop
- [ ] Trust Strip presente

#### Cores/Estilos
- [ ] Cores no tailwind.config
- [ ] Fonte Inter carregada
- [ ] CSS padrão presente

#### Conteúdo
- [ ] H1 presente
- [ ] 4 métricas
- [ ] 6+ features
- [ ] 3 reviews
- [ ] 7+ FAQ
- [ ] SEO Text

#### SEO
- [ ] Title com keyword + ano
- [ ] Meta description 130-155 chars
- [ ] Canonical
- [ ] hreflang
- [ ] Open Graph
- [ ] JSON-LD completo

#### Compliance
- [ ] Footer com links
- [ ] Modais configurados
- [ ] Disclaimer discreto
- [ ] Advertising Disclosure

#### CTAs
- [ ] Navbar CTA
- [ ] Hero CTA
- [ ] Features CTA
- [ ] Sticky Mobile CTA

### Output
Relatório de validação com:
- Itens OK (✓)
- Erros (✗) + correção

---

## 🚀 Ver Também

- Workflow: `01-workflow.md`
- Guia Técnico: `02-guide.md`
