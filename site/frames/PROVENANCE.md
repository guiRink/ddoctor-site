# Proveniência dos quadros

Todos os arquivos `desktop/frame-0001..0240.webp` (1440×810) e `mobile/frame-0001..0240.webp` (540×960, recorte 9:16) são extraídos de `media/filme-oficina.mp4`, um filme de 30,25 s montado em 2026-10-02 a partir de seis clipes de 5 s gerados no Higgsfield (modelo Kling v3.0, modo pro, sem áudio, 16:9), cada um em image-to-video a partir de uma foto real da oficina recortada em 16:9:

1. Fachada — prompt: "Slow cinematic dolly-in toward the entrance of this car body shop at golden hour… No people, no new text, no changes to the sign."
2. Recepção — "Slow forward dolly down the reception bay between the dark grey BMW and the white Volvo toward the yellow PARE AQUI sign…"
3. Funilaria — "Slow dolly from the tool bench toward the blue BMW with its hood open in the body shop…"
4. Polimento (luminárias hexagonais) — "Slow lateral dolly from left to right across the detailing bay…"
5. Higienização — "Slow orbit around the front of the dark grey BMW X5 in the wash bay…"
6. Pátio/galeria — "Slow push-in toward the front grille and headlights of the grey BMW 4 Series…"

Extração: desktop pelo `extract_frames.py` do skill animated-website (240 quadros, WebP q50); mobile por ffmpeg (`crop=608:1080` com x deslizando de 280 para 170 ao longo da fachada (acompanha o push-in) e 656 nos demais, `scale=540:960`) + cwebp q52.
