# 📘 Guia Técnico - Criação de Landing Pages

> **Versão:** 2.0  
> **Modelo Base:** Sema7 Layout

---

## ⚙️ Stack Técnica

| Item | Escolha |
|------|---------|
| **Framework CSS** | Tailwind CSS CDN |
| **Ícones** | FontAwesome 6.4.0 |
| **Fontes** | Google Fonts - Inter |
| **Output** | index.html único |
| **Imagens** | .webp em images/ |

---

## 🎨 Cores de Autoridade (Padrão)

Quando não informadas:

| Elemento | Cor | Hex |
|----------|-----|-----|
| Primária | Verde Natureza | #059669 |
| Escura | Verde Escuro | #047857 |
| Clara | Verde Claro | #10b981 |
| CTA | Verde Vibrante | #22c55e |
| CTA Hover | Verde Escuro | #16a34a |
| Fundo | Cinza Prof. | #f5f5f5 |
| Texto | Cinza Escuro | #1f2937 |
| Muted | Cinza Médio | #6b7280 |

---

## 🏗️ Estrutura de 9+ Seções

### 1. Alert Bar
- Fundo cor brand, texto white, uppercase
- 2-3 valores separados por `|`
- Ex: "Frete Grátis | 30 Dias Garantia | 100% Natural"

### 2. Navbar
- Sticky com backdrop-blur
- Logo (texto ou imagem)
- Links âncora (desktop)
- CTA para checkout

### 3. Hero (MODELO SEMA7)
- Fundo cinza claro (`bg-brand-gray`)
- **Accent decorativo** na lateral (div absoluta com clip-path)
- **Layout híbrido:**
  - Mobile: texto → imagem → CTA
  - Desktop: 2 colunas (texto |Trust Strip** abaixo ( imagem)
- **4 ícones)

### 4. Prova Social
- Fundo branco
- 4 métricas em grid

### 5. Benefícios
- Fundo branco
- Título + parágrafos explicativos

### 6. Features Grid
- Fundo cinza
- 6 cards com ícones
- Hover com translateY

### 7. Reviews
- Fundo branco
- 3 depoimentos + estatísticas

### 8. FAQ
- Fundo cinza
- 7+ perguntas accordion

### 9. SEO Text
- Fundo branco
- 4-6 parágrafos com keywords

### 10. Footer
- Fundo escuro
- Links que abrem modais
- Disclaimer discreto

### 11. CTA Sticky Mobile
- Fixo em bottom-0
- Só aparece em mobile

---

## 🔧 Configuração Tailwind

```javascript
tailwinct = {
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#059669',
          primaryDark: '#047857',
          primaryLight: '#10b981',
          cta: '#22c55e',
          ctaHover: '#16a34a',
          gray: '#f5f5f5',
          grayMid: '#e5e7eb',
          dark: '#1f2937',
          text: '#1f2937',
          muted: '#6b7280'
        }
      }
    }
  }
}
```

---

## 📦 Estrutura de Cada Projeto

```
[produto]-offer/
├── index.html      ← Página completa
├── README.md       ← Doc rápida
├── prd.json       ← Requisitos
└── images/        ← Imagens (vazio)
```

---

## 📋 Regras por País

| País | Idioma | Moeda | hreflang |
|------|--------|-------|----------|
| Romênia | ro | RON | ro-RO |
| Alemanha | de | EUR | de-DE |
| Brasil | pt | BRL | pt-BR |
| EUA | en | USD | en-US |

---

## ⚡ Checklist de Validação

- [ ] HTML modelo Sema7
- [ ] Cores configuradas
- [ ] Hero híbrido (mobile/desktop)
- [ ] Trust Strip
- [ ] 4 métricas
- [ ] 6+ features
- [ ] 3 reviews
- [ ] 7+ FAQ
- [ ] SEO completo
- [ ] Footer + Modais
- [ ] Disclaimer discreto
- [ ] CTA sticky mobile
- [ ] JSON-LD

---

## 🔄 SEO - Head Completo

```html
<title>[Produto] | [Benefício] (2025)</title>
<meta name="description" content="[130-155 chars]">
<meta name="keywords" content="[20+ keywords]">
<meta name="robots" content="index, follow">
<link rel="canonical" href="...">
<link rel="alternate" hreflang="[lang]" href="...">
<meta property="og:type" content="product">
<meta property="og:image" content="images/hero.webp">

<script type="application/ld+json">
{
  "@type": "Product",
  "name": "...",
  "offers": { "priceCurrency": "...", "price": "..." },
  "aggregateRating": { "ratingValue": "4.9", "reviewCount": "..." }
}
</script>
```

---

## 📖 Referências

- **Workflow:** `01-workflow.md`
- **Skills:** `03-skills.md`
- **Page Analyzer:** `04-page-analyzer.md`
