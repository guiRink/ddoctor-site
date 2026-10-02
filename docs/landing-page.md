# Landing page D doctor — como funciona

## Rodar localmente

```bash
node tools/serve.mjs site 8765
```

Abra http://localhost:8765/. O painel (botão **Entrar**) está em `site/painel/` como placeholder.

## Estrutura

- `site/index.html` — página única (HTML, CSS e JS). O filme é uma sequência de 160 quadros WebP desenhada num `<canvas>` e controlada pelo scroll (motor do skill *animated-website*: carga progressiva, fallback para o quadro mais próximo, remapeamento com "dwell" nos centros dos capítulos, LERP).
- `site/frames/desktop` (1600×900, ~14 MB) e `site/frames/mobile` (540×960 em retrato, recorte central 9:16 do filme, ~6 MB).
- `site/assets/fotos/*.webp` — as 10 fotos reais da oficina, otimizadas.
- `site/assets/logo-mark.svg` — o "D" amarelo reconstruído em vetor.
- `site/assets/fonts/` — Archivo variável (títulos e texto) e Quicksand 700 (palavra "doctor" da marca), self-hosted.
- `media/filme-oficina.mp4` — filme-fonte (30 s, 1920×1080, 24 fps), 6 clipes de 5 s gerados no Higgsfield (Kling 3.0 pro, image-to-video) a partir das fotos recortadas em 16:9. Ordem: fachada → recepção → funilaria → polimento/espelhamento → higienização → pátio.
- `tools/shot.mjs` — captura de tela headless via Chrome DevTools Protocol (`node tools/shot.mjs out.png URL 1440 900 9000`).
- `?p=0.585` na URL posiciona o filme nessa fração do scroll (atalho de revisão).

## Regenerar os quadros

Desktop (16:9):

```bash
python3 "<skill animated-website>/scripts/extract_frames.py" --input media/filme-oficina.mp4 --output site/frames --frames 160 --quality 55 --desktop-res 1600x900 --desktop-only
```

Mobile (retrato 9:16, recorte central; o ffmpeg daqui não tem libwebp, por isso passa por PNG + cwebp):

```bash
ffmpeg -y -i media/filme-oficina.mp4 -vf "fps=160/30.25,crop=608:1080:'if(lt(t\,5.04)\,280-110*t/5.04\,656)':0,scale=540:960:flags=lanczos" -frames:v 160 /tmp/mframes/frame-%04d.png && for f in /tmp/mframes/*.png; do cwebp -q 58 "$f" -o "site/frames/mobile/$(basename "${f%.png}").webp"; done
```

Se mudar a contagem, atualize `FRAME_COUNT` e o texto `Q 001 / 160` em `site/index.html`.

## Conteúdo a confirmar com a oficina

- Endereço completo (a página mostra "Curitiba, PR · endereço completo a confirmar"; o número 3316 aparece na fachada) e link real do Google Maps.
- Telefones lidos das placas: WhatsApp (41) 99761-6204 e fixo (41) 3332-5572.
- Horário de atendimento (hoje "horário comercial").
- O serviço "Sinistros e seguradoras" foi incluído porque a oficina trabalha com seguradoras via Maxpar; confirmar o texto.
- Logo oficial em vetor, se existir, para substituir o SVG reconstruído.
