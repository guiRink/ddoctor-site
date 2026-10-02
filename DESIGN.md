---
name: D doctor — martelinho de ouro
description: Sinalização de oficina como interface — amarelo e preto em placas chapadas, letreiro condensado em Archivo, faixa zebrada como régua.
colors:
  yellow: "#F2C200"
  black: "#0A0A0A"
  graphite: "#15161A"
  graphite-2: "#1E2025"
  paper: "#F4F3EE"
  paper-soft: "rgba(244, 243, 238, 0.70)"
  paper-hairline: "rgba(244, 243, 238, 0.14)"
  ink: "#0A0A0A"
  ink-soft: "rgba(10, 10, 10, 0.66)"
  ink-hairline: "rgba(10, 10, 10, 0.14)"
typography:
  display:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(64px, 10.5vw, 164px)"
    fontWeight: 800
    lineHeight: 0.82
    letterSpacing: "-0.04em"
    fontVariation: "'wdth' 76–98 (acompanha o progresso do filme)"
  headline:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(48px, 7.6vw, 124px)"
    fontWeight: 800
    lineHeight: 0.84
    letterSpacing: "-0.04em"
    fontVariation: "'wdth' 78–80"
  title:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(28px, 3.6vw, 56px)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.04em"
    fontVariation: "'wdth' 84"
  quote:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(30px, 4.6vw, 74px)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.04em"
    fontVariation: "'wdth' 76"
  deck:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(17px, 1.5vw, 23px)"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.015em"
    fontVariation: "'wdth' 100"
  body:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(15px, 1.2vw, 18px)"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
    fontVariation: "'wdth' 100"
  label:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.10em"
    fontFeature: "uppercase, tabular-nums"
  button:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.04em"
    fontFeature: "uppercase"
  wordmark:
    fontFamily: "Quicksand, Avenir Next, Helvetica Neue, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.01em"
rounded:
  none: "0px"
spacing:
  xs: "10px"
  sm: "12px"
  md: "18px"
  lg: "24px"
  xl: "28px"
  2xl: "32px"
  touch: "44px"
  grid-gap: "clamp(10px, 1.2vw, 20px)"
  gutter: "clamp(20px, 4.2vw, 72px)"
  section: "clamp(80px, 10vw, 150px)"
  section-lg: "clamp(90px, 11vw, 170px)"
components:
  button-yellow:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.black}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 18px"
    height: "44px"
  button-yellow-hover:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.black}"
  button-ghost:
    backgroundColor: "rgba(10, 10, 10, 0.35)"
    textColor: "{colors.paper}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 18px"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "rgba(10, 10, 10, 0.60)"
    textColor: "{colors.paper}"
  button-black:
    backgroundColor: "{colors.black}"
    textColor: "{colors.paper}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "0 18px"
    height: "44px"
  button-black-hover:
    backgroundColor: "{colors.graphite-2}"
    textColor: "{colors.paper}"
  tag-yellow:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.black}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "12px 16px"
  tag-yellow-hover:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.black}"
  plate:
    backgroundColor: "{colors.black}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "12px 0 4px"
  plate-item:
    backgroundColor: "{colors.black}"
    textColor: "{colors.paper}"
    padding: "clamp(22px, 2.8vw, 36px) clamp(20px, 3vw, 44px)"
  contact-cell:
    backgroundColor: "{colors.black}"
    textColor: "{colors.paper}"
    rounded: "{rounded.none}"
    padding: "26px 24px 28px"
  shot-caption:
    backgroundColor: "{colors.black}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    padding: "10px 14px"
  nav-link:
    textColor: "{colors.paper-soft}"
    height: "44px"
  nav-link-hover:
    textColor: "{colors.paper}"
---

# Design System: D doctor — martelinho de ouro

## Overview

**Creative North Star: "A Sinalização da Oficina"**

A D doctor já tinha uma linguagem visual antes do site: a placa preta com o D amarelo na fachada, o piso modular preto e amarelo das baias, a placa "ORÇAMENTO — PARE AQUI" na recepção. O sistema não inventa uma identidade digital; ele pega essa sinalização física e a usa como interface. Cada superfície é uma placa: um retângulo chapado, sem raio, sem sombra, pintado inteiro de amarelo, preto ou papel. Texto grande e condensado como letreiro, texto pequeno em caixa alta como etiqueta de sinalização, e uma faixa zebrada amarelo/preto que funciona como régua de progresso e como borda inferior das placas.

A densidade é baixa e o contraste é máximo. O amarelo não é um acento aplicado em pequenas doses: ele é comprometido em áreas inteiras (o loader é uma placa amarela de tela cheia; a seção de serviços é um bloco amarelo com uma placa preta dentro). Dentro do filme, porém, o amarelo recua para o papel de marcação: a palavra-chave do título, a régua acima do título, o rótulo do capítulo. A oficina real é a prova visual — fotos e frames do próprio lugar, nunca stock — e a tipografia se comporta como se estivesse pintada sobre essas superfícies.

Rejeições confirmadas pela construção: nenhum raio de borda em elemento algum; nenhuma sombra de caixa decorativa em repouso; nenhum gradiente de cor (gradientes existem apenas como scrim neutro sobre o filme e no cabeçalho translúcido); nenhum vermelho, mesmo que exista pontualmente na sinalização física.

**Key Characteristics:**
- Três materiais chapados — amarelo, preto, papel — aplicados em áreas inteiras, nunca como detalhe.
- Archivo variável com eixo de largura: títulos condensados (wdth 76–90), texto corrido em largura normal (wdth 100).
- Zero raio, zero sombra de caixa; profundidade vem da troca de material entre blocos empilhados.
- Faixa zebrada 45° amarelo/preto como régua e como borda inferior de placa.
- Etiquetas de 11px em caixa alta com tracking .10em e numerais tabulares, usadas como telemetria e legenda.
- Grade de 12 colunas, calha fluida, blocos de seção com padding em `clamp`.

## Colors

Uma paleta de três materiais opacos (amarelo, preto, papel) mais um grafite de suporte, com transparências do papel e da tinta para hierarquia secundária e fios.

### Primary
- **Amarelo da fachada** (`{colors.yellow}`): a cor da placa e do piso. Pintada em áreas inteiras (loader, fundo da seção de serviços), e dentro do filme reservada a marcação: a palavra enfatizada do título (`em`), a régua de 64×6 acima do título, o rótulo do capítulo na telemetria, o sublinhado dos links, a scrollbar, a seleção de texto, o anel de foco e o botão primário. É também a cor do D no logotipo.

### Neutral
- **Preto da placa** (`{colors.black}` / `{colors.ink}`): fundo padrão do documento, do palco do filme, das placas e do rodapé. O mesmo hex serve como tinta sobre amarelo e papel (`ink`), de propósito: a tinta é a placa.
- **Grafite** (`{colors.graphite}`): placeholder atrás das fotos da galeria enquanto carregam; no painel, fundo da placa de aviso.
- **Grafite 2** (`{colors.graphite-2}`): estado hover do botão preto. Único lugar onde o preto clareia.
- **Papel** (`{colors.paper}`): texto sobre preto; fundo inteiro da seção da galeria; estado hover dos botões amarelo e da etiqueta amarela (a placa "vira papel" ao toque).
- **Papel suave** (`{colors.paper-soft}`): texto secundário sobre preto — descrições da placa de serviços, links da navegação em repouso, legenda da citação, telefone miúdo, rodapé.
- **Fio de papel** (`{colors.paper-hairline}`): divisórias de 1px entre itens da placa e a malha de 1px da grade de contato. É o único fio sobre preto.
- **Tinta suave** (`{colors.ink-soft}`): texto secundário sobre amarelo ou papel (parágrafos laterais de serviços e galeria).
- **Fio de tinta** (`{colors.ink-hairline}`): trilho do progresso no loader amarelo.

### Named Rules
**The Whole-Plate Rule.** O amarelo é aplicado a um bloco inteiro ou a uma marcação pequena; nunca como fundo parcial, borda decorativa ou gradiente. Teste: se um elemento amarelo não é nem uma seção/placa completa nem uma marcação de até uma linha de texto, está errado.

**The Ink-Is-Black Rule.** Sobre amarelo e sobre papel, o texto é o mesmo preto da placa (`#0A0A0A`), não um cinza escuro. A hierarquia secundária vem de transparência (`ink-soft`), nunca de uma segunda cor de texto.

**The One-Hairline Rule.** Fios sobre preto são sempre 1px em `paper-hairline` (.14). Fios sobre amarelo usam `ink-hairline` (.14) ou um traço cheio de 2px em preto (rodapé do loader, cabeçalho da galeria). Não existem fios em cinza opaco.

## Typography

**Display Font:** Archivo variável (self-hosted, wght 300–900, wdth 62–125), com fallback Helvetica Neue / Arial
**Body Font:** Archivo (a mesma família; a hierarquia vem de peso e largura, não de uma segunda família)
**Wordmark Font:** Quicksand 700 (self-hosted), usada exclusivamente na palavra "doctor" do logotipo e do loader

**Character:** Letreiro de oficina. Os títulos são Archivo 800 condensada (wdth 76–90), com tracking apertado de −.04em e entrelinha abaixo de 0.9, como letras pintadas em uma placa. O texto corrido volta à largura normal (wdth 100) e a pesos 400–500. As etiquetas em caixa alta de 11px com tracking .10em são a tipografia das plaquetas de sinalização e da telemetria.

### Hierarchy
- **Display** (800, `clamp(64px, 10.5vw, 164px)`, lh .82, −.04em, wdth 76→98): o título do filme no palco. A largura cresce com o progresso do scroll (JS escreve `--title-wdth` de 76 a 98), então o letreiro "abre" conforme o visitante avança.
- **Headline** (800, `clamp(48px, 7.6vw, 124px)` até `clamp(54px, 9vw, 150px)`, lh .82–.86, −.04em, wdth 78–80): títulos das seções fora do filme (serviços, galeria, contato) e dos capítulos secundários do filme.
- **Title** (800, `clamp(28px, 3.6vw, 56px)`, lh .95, −.04em, wdth 84): nome de cada serviço na placa preta. Precedido de um ponto amarelo tipográfico.
- **Quote** (700, `clamp(30px, 4.6vw, 74px)`, lh 1.12, −.04em, wdth 76): a frase da parede da recepção. É a única passagem longa em display, por isso a entrelinha sobe para 1.12.
- **Deck** (500, `clamp(17px, 1.5vw, 23px)`, lh 1.3, −.015em): a frase de apoio abaixo de cada título, limitada a 30–34rem.
- **Body** (400, `clamp(15px, 1.2vw, 18px)`, lh 1.5): descrições na placa de serviços, limitadas a 42ch. Textos laterais de seção usam a variação `clamp(16px, 1.35vw, 22px)` em `ink-soft`, até 28–30rem.
- **Label** (600, 11px, .10em, caixa alta, numerais tabulares): a classe `.micro`. Telemetria ("FACHADA", "Q 001 / 160"), legendas das fotos, rótulos das células de contato, rodapé do loader, legenda da citação.
- **Button** (800, 13px, .04em, caixa alta): todos os botões. Nos CTAs finais sobe para 14px.
- **Wordmark** (Quicksand 700, 21px, −.01em): a palavra "doctor" ao lado do D em SVG; sob ela a tagline em 11px/.14em amarela.

### Named Rules
**The Condensed-Letreiro Rule.** Tudo acima de ~28px é Archivo 800 em wdth 76–90 com −.04em e entrelinha ≤ .95; tudo abaixo volta a wdth 100. Não existe título em largura normal nem corpo condensado.

**The Yellow-Word Rule.** Em cada título há no máximo um trecho em amarelo (`em`, sem itálico), e ele é a palavra que carrega o sentido: "de ouro", "Pare aqui", "express". Nunca dois trechos, nunca a frase inteira.

**The Tabular-Label Rule.** Etiquetas que carregam número (quadro, porcentagem, "Foto 02 / 05") usam numerais tabulares e zero à esquerda com 3 dígitos, para que a telemetria não trema ao mudar.

## Layout

A página é uma pilha de blocos de largura total, cada um pintado de um material: palco do filme (preto, `900vh` de rolagem com `position: sticky` de `100svh`), serviços (amarelo), citação (preto), galeria (papel), contato (preto), rodapé (preto com faixa zebrada). Não há container centralizado com largura máxima; o conteúdo vai de calha a calha, e a calha é fluida: `clamp(20px, 4.2vw, 72px)` no desktop, 18px fixos abaixo de 780px.

Dentro de cada bloco, grade de 12 colunas com `column-gap: clamp(10px, 1.2vw, 20px)`. Os capítulos do filme ocupam as colunas 1–9 (ou 1–11 no herói) alinhados à esquerda e ao rodapé, ou 7–13 à direita quando o frame pede (`data-side="right"`, que também inverte o scrim). A citação ocupa 2–12. Na galeria a folha de contato usa 1–8 / 8–13 na primeira linha e 1–5 / 5–9 / 9–13 na segunda. No contato, título em 1–9 e CTAs em 9–13, com a grade de três células em 1–13.

Ritmo vertical: padding de seção `clamp(80px, 10vw, 150px)` (serviços, galeria) ou `clamp(90px, 11vw, 170px)` (citação, contato); distância do cabeçalho de seção ao conteúdo `clamp(36px, 5vw, 72px)` até `clamp(40px, 6vw, 88px)`. Espaçamentos internos em passos de 10 / 12 / 18 / 24 / 28 / 32px; todo alvo tocável tem no mínimo 44px de altura.

Breakpoint único em 780px: a grade do filme cai para 6 colunas, a navegação central some (ficam logo, WhatsApp e Entrar), os cabeçalhos de seção empilham, a placa de serviços vira uma coluna, a folha de fotos vira 6 colunas (lead e side em largura total, a/b lado a lado, c inteira), a grade de contato vira uma coluna e o frame set troca para retrato. Abaixo de 360px o botão WhatsApp do cabeçalho mostra só o ícone. Com `prefers-reduced-motion`, o filme vira um pôster estático de `100svh` com apenas o capítulo herói e sem telemetria.

## Elevation & Depth

Sistema plano. Não há sombra de caixa em repouso em nenhuma placa, botão ou card. A profundidade é feita por troca de material entre blocos (amarelo sobre preto, preto sobre amarelo, papel sobre preto) e por fios de 1px em transparência. Elementos que se sobrepõem ao filme ficam legíveis por um scrim neutro (dois gradientes de `#0A0A0A` a transparente, opacidade modulada entre .78 e .9 pelo JS) e, no texto do capítulo, por um text-shadow difuso que serve à legibilidade, não à decoração.

### Shadow Vocabulary
- **Legibilidade do título sobre filme** (`text-shadow: 0 2px 24px rgba(10,10,10,.45)`): só em `.chapter__title`. Nunca em títulos sobre fundo chapado.
- **Legibilidade do deck sobre filme** (`text-shadow: 0 1px 14px rgba(10,10,10,.6)`): só em `.chapter__deck`.
- **Cabeçalho sólido** (`box-shadow: 0 6px 24px -8px rgba(10,10,10,.6)`): aparece apenas quando o cabeçalho fixo deixa o palco e vira preto sólido sobre a seção amarela; é a única sombra de caixa da página.
- **Vidro do botão fantasma** (`backdrop-filter: blur(6px)` sobre `rgba(10,10,10,.35)`): só em `.btn--ghost`, para ler sobre o filme.

### Named Rules
**The Flat-Plate Rule.** Superfícies não projetam sombra. Se algo precisa se destacar, troca de material (vira amarelo, vira papel) ou ganha a faixa zebrada; não ganha sombra.

**The Film-Only Shadow Rule.** Text-shadow e backdrop-filter existem apenas para texto e botões que flutuam sobre os frames do filme. Fora do palco, nenhum.

## Shapes

Raio zero em tudo: botões, placas, células, fotos, trilhos, loader. Os retângulos são cortados reto como placas de sinalização. Bordas, quando existem, são de três tipos: fio de 1px em transparência (divisórias, malha de contato, trilho da telemetria), traço cheio de 2px em preto (rodapé do loader, cabeçalho da galeria) e a **faixa zebrada** — `repeating-linear-gradient(-45deg, amarelo 0 10px, preto 10px 20px)` aplicada como `border-image` de 14px na base da placa de serviços e do rodapé, e como preenchimento do trilho de progresso (com `background-size: 28px 28px`). A régua de capítulo é um traço de 64×6 em amarelo; a régua da citação, 44×4. As fotos são sempre 4:3 com legenda em placa preta colada na base. Os botões levam borda de 2px na própria cor (amarelo em amarelo, preto em preto) para que o fantasma, com borda em `rgba(244,243,238,.34)`, tenha a mesma caixa.

## Components

### Buttons
Placas chapadas, caixa alta, 44px de altura mínima, borda de 2px, raio zero.
- **Shape:** retângulo reto (0px), `padding: 0 18px`, `min-height: 44px`; nos CTAs do capítulo final e do contato, 56–60px e 14px de fonte.
- **Primary (`.btn--yellow`):** fundo e borda amarelos, texto preto. É o WhatsApp e só o WhatsApp — o único botão amarelo da tela em qualquer momento.
- **Hover / Focus:** o amarelo vira papel (`paper` em fundo e borda) em 200ms; `:active` desce 1px; foco visível é um anel de 2px amarelo com offset de 5px.
- **Ghost (`.btn--ghost`):** `rgba(10,10,10,.35)` com `backdrop-filter: blur(6px)`, borda `rgba(244,243,238,.34)`, texto papel; no hover a borda vira papel e o fundo `rgba(10,10,10,.6)`. Usado para "Entrar" e "Ligar".
- **Black (`.btn--black`):** preto com borda preta; hover em `graphite-2`. Para uso sobre amarelo ou papel.
- **Ícones:** SVG inline de 18px, `currentColor`, à esquerda do rótulo, gap 10px.

### Chips (etiqueta amarela de capítulo, `.chapter__tag`)
- **Style:** placa amarela com texto preto em `label` (11px/.10em/caixa alta), `padding: 12px 16px`, seta SVG de 16px à direita.
- **State:** entra com fade + 12px de deslocamento 200ms após o título; hover vira papel. É um link de ação dentro do filme, não um filtro.

### Cards / Containers (a placa, `.plate`; a malha de contato, `.contact__grid`)
- **Corner Style:** 0px.
- **Background:** preto sobre a seção amarela (placa de serviços); preto sobre preto separado por malha de 1px em `paper-hairline` (contato).
- **Shadow Strategy:** nenhuma; ver Elevation & Depth.
- **Border:** a placa de serviços termina em faixa zebrada de 14px (`border-image`). Itens separados por 1px em `paper-hairline`, o primeiro sem fio.
- **Internal Padding:** itens da placa `clamp(22px, 2.8vw, 36px) clamp(20px, 3vw, 44px)`, em duas colunas 1.1fr / 1fr alinhadas pela linha de base (título à esquerda, descrição à direita); células de contato `26px 24px 28px` com gap de 10px entre etiqueta, valor e nota.

### Links
- Links de texto são papel com sublinhado amarelo de 3px e offset de 6px (contato) ou 1px/5px (rodapé); no hover o texto vira amarelo e o sublinhado vira papel.

### Navigation
- **Style:** cabeçalho fixo em três colunas (marca / navegação centrada / ações), `padding: 14px gutter`, fundo em gradiente de `rgba(10,10,10,.78)` a transparente sobre o filme; vira preto sólido com a única sombra de caixa da página ao sair do palco (`.is-solid`).
- **Typography:** links em 13px/600/.02em, cor `paper-soft`, hover `paper`, 44px de altura.
- **Marca:** D em SVG amarelo de 32px, "doctor" em Quicksand 700/21px, tagline 11px/.14em em amarelo.
- **Mobile:** navegação central oculta; ficam logo (28px, sem tagline), WhatsApp (40px, 12px de fonte) e Entrar.

### Telemetria (componente de assinatura)
Faixa de sinalização fixa na base do palco: rótulo do capítulo em amarelo (`label`), trilho de 12px com fio `rgba(244,243,238,.22)` sobre `rgba(244,243,238,.10)` preenchido pela faixa zebrada em `scaleX(--frame-progress)`, contador de quadro "Q 001 / 160" em `paper-soft`, e o aviso "Role a página" com chevron amarelo pulsando (1.8s). No mobile o aviso some. Com movimento reduzido, a telemetria inteira some.

### Loader (placa amarela de tela cheia)
Placa amarela ocupando a viewport, com o D e a palavra "doctor" em Quicksand gigante (`clamp(64px, 15vw, 220px)`), rodapé com traço de 2px preto, trilho de 10px em `ink-hairline` com preenchimento preto e porcentagem em 3 dígitos. Sai por `clip-path` de baixo para cima em 900ms com `ease-out`.

### Folha de contato (galeria, `.sheet` / `.shot`)
Fotos reais 4:3 em grade de 12 colunas (7+5, depois 4+4+4), fundo `graphite` enquanto carregam, zoom de 2.5% em 900ms no hover, legenda em placa preta colada na base com nome da baia à esquerda e "Foto 0N / 05" à direita.

### Movimento
Uma única curva, `cubic-bezier(.22, 1, .36, 1)`, para tudo que se move com intenção (revelação de título 760ms, régua 650ms, etiqueta 500ms, zoom de foto 900ms, saída do loader 900ms). Trocas de cor em botões e links usam `ease` linear de 200ms. Revelação de texto por máscara (`overflow: hidden` + `translateY(112%)`), com escalonamento de 90ms e 160ms entre linhas. O filme avança por interpolação (`LERP 0.115`) com paradas gaussianas nos seis capítulos.

## Do's and Don'ts

### Do:
- **Do** pintar seções inteiras de um material só — amarelo, preto ou papel — e empilhá-las; a mudança de material é a transição.
- **Do** usar Archivo 800 condensada (wdth 76–90, −.04em, entrelinha ≤ .95) em todo título acima de ~28px e voltar a wdth 100 no texto corrido.
- **Do** destacar uma única palavra do título em amarelo (`em`, sem itálico) e deixar o resto em papel ou preto.
- **Do** usar a faixa zebrada (`repeating-linear-gradient(-45deg, amarelo 0 10px, preto 10px 20px)`) como borda inferior de placa (14px) ou como preenchimento de progresso; é a assinatura do sistema.
- **Do** manter 44px de altura mínima em todo alvo tocável e um anel de foco de 2px amarelo com 5px de offset.
- **Do** usar a classe `.micro` (11px/600/.10em/caixa alta/tabular) para toda etiqueta de sinalização: legenda, telemetria, rótulo de célula.
- **Do** reservar o botão amarelo ao WhatsApp e o fantasma a "Entrar"/"Ligar"; sobre amarelo ou papel, usar o botão preto.
- **Do** usar fotos e frames da oficina real como única imagem do sistema.

### Don't:
- **Don't** arredondar nada: raio é 0px em botões, placas, fotos, trilhos e células.
- **Don't** aplicar `box-shadow` a placas, botões ou cards em repouso; a única sombra de caixa é a do cabeçalho sólido.
- **Don't** usar text-shadow ou backdrop-filter fora do palco do filme.
- **Don't** usar o amarelo como gradiente, borda decorativa ou fundo parcial; ou é a placa inteira, ou é uma marcação de até uma linha.
- **Don't** introduzir uma segunda cor de texto: hierarquia secundária é `paper-soft` sobre preto e `ink-soft` sobre amarelo/papel.
- **Don't** usar Quicksand fora da palavra "doctor" do logotipo e do loader.
- **Don't** usar fios em cinza opaco; divisórias são 1px em `rgba(244,243,238,.14)` sobre preto ou 2px pretos cheios sobre amarelo/papel.
- **Don't** colocar mais de um botão amarelo na mesma tela.
- **Don't** usar vermelho, mesmo existindo pontualmente na sinalização física da oficina.
