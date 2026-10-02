# Product

<!-- impeccable:product-schema 1 -->

> Registro inicial escrito a partir do brief do Guilherme e das fotos em `fotos/`. Itens marcados **[inferido]** vieram da leitura das fotos/placas da oficina ou do brief, não de confirmação direta; itens marcados **[aberto]** ainda precisam de resposta do cliente.

## Platform

web

## Stack

delegated: HTML/CSS/JS estático sem framework para a landing page (sequência de frames em canvas controlada por scroll, sem build step). O painel de gestão será decidido separadamente quando começar. **[inferido]** do pedido de "um site" com landing animada tipo vídeo-no-scroll e do fato de o projeto não ter scaffold.

## Users

- **Dono / gestor da oficina D doctor** (cliente do Guilherme). Hoje opera o sistema Maxpar (obrigatório para falar com as seguradoras) e planilhas Excel paralelas. Acha o Maxpar confuso. Vai usar o botão "Entrar" da landing para acessar o painel de gestão.
- **Motorista de carro premium em Curitiba e região** **[inferido]** (DDD 41 nas placas; frota das fotos: BMW, Porsche, Mercedes, Volvo, Land Rover, Jeep). Situação: carro com amassado, risco, pintura opaca ou interior sujo; muitas vezes encaminhado por seguradora. Job: confiar o carro a alguém, saber o que a oficina faz e entrar em contato rápido (WhatsApp).
- **Seguradoras** **[inferido]**: não são público da landing. Conversam com a oficina via Maxpar (aviso de carro novo, pedido de aprovação, etc.).

## Product Purpose

Site da oficina D doctor com duas partes: (1) landing page pública, cinematográfica, que apresenta a oficina e leva ao WhatsApp; (2) painel de gestão interno (fase seguinte) que substitui as planilhas Excel e organiza o que o Maxpar não cobre, sem substituir o Maxpar na comunicação com as seguradoras. Sucesso da landing: visitante entende em segundos o que a D doctor faz e para quem, e chama no WhatsApp; o gestor entra no painel pelo topo.

## Positioning

**[inferido das placas]** "Martelinho de ouro" com experiência internacional em reparação automotiva em mais de 15 países, atendendo frota premium. Mecanismo que o vizinho não copia: reparo de funilaria sem repintura (martelinho), oficina organizada com baias dedicadas (funilaria, espelhamento, higienização) e padrão visual próprio (piso modular preto e amarelo).

## Operating Context

- Operação diária no Maxpar (sistema das seguradoras) + planilhas Excel para controle interno.
- Fluxo com seguradora: carro novo entra → aviso/abertura no Maxpar → orçamento → pedido de aprovação → execução → entrega. **[inferido]**, detalhar ao estudar o Maxpar.
- Fisicamente: fachada amarela com painel preto, recepção com placa "ORÇAMENTO — PARE AQUI", pátio coberto, baias internas com piso modular.

## Capabilities and Constraints

- Landing: scroll controla um filme (sequência de frames WebP em canvas), botão "Entrar" fixo no topo → painel. Contato via WhatsApp.
- Vídeo-fonte gerado por IA (Higgsfield) a partir das fotos reais da oficina em `fotos/`; fotos complementares podem ser geradas se faltar.
- Painel de gestão: **[aberto]** escopo exato (o Guilherme ainda vai detalhar o que vai ter dentro).
- Maxpar continua em uso obrigatório para a seguradora; o painel não o substitui.
- Idioma: português do Brasil.

## Brand Commitments

- Nome: **D doctor** — tagline "martelinho de ouro" (grafia exata da placa: "D" em caixa alta, "doctor" em minúsculas).
- Cores do local **[inferido das fotos]**: amarelo saturado (fachada, piso, faixas de parede), preto/grafite, branco. Vermelho aparece só em sinalização pontual.
- Serviços nas placas: soluções automotivas, funilaria express, polimento e espelhamento, higienização. Também há placa "Funilaria" e referência a películas automotivas numa parede **[inferido]**.
- A landing também lista "Sinistros e seguradoras" como frente de atendimento e usa a palavra "premium" **[inferido do brief]**: a oficina atende carros encaminhados por seguradora via Maxpar e a frota das fotos é premium. Confirmar o texto com o cliente.
- Frase da parede (citação de Ayrton Senna, reproduzida na recepção): "No que diz respeito ao empenho, ao compromisso, ao esforço, à dedicação, não existe meio termo. Ou você faz uma coisa bem feita ou não faz." **[inferido da foto]**
- Contatos nas placas **[inferido das fotos, confirmar]**: WhatsApp (41) 99761-6204, fixo (41) 3332-5572, número do imóvel 3316. Endereço completo **[aberto]**.
- Bandeiras na parede: Brasil, EUA, Argentina, Uruguai, Colômbia, Itália, Espanha, Alemanha, Portugal, Turquia, México, Croácia, entre outras **[inferido]**, reforçando "mais de 15 países".

## Evidence on Hand

- 10 fotos reais da oficina em `fotos/` (1448×1086 PNG): fachada, recepção, pátio, galeria de SUVs, oficina com luminárias hexagonais, baia de higienização, funilaria com sedã azul, preparação com mascaramento, oficina coberta.
- Não há depoimentos, números de carros atendidos, nomes de seguradoras parceiras, preços ou prazos. **Não inventar.**
- Logo vetorial: não disponível; o "D" amarelo em caixa com "doctor" branco aparece nas fotos e pode ser reconstruído em SVG a partir delas.

## Product Principles

1. A oficina real é a prova: fotos e vídeo do próprio lugar, nunca stock genérico.
2. Uma ação clara para o visitante (WhatsApp) e uma para o gestor (Entrar); nada compete com elas.
3. Falar só o que a oficina já afirma nas placas; sem promessas, prazos ou números inventados.
4. O painel futuro deve ser mais simples que o Maxpar, não mais um sistema confuso.
5. Amarelo e preto são identidade, não decoração: usar com compromisso.
