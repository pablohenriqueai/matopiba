# SoJão — Inteligência Agrícola

Aplicação local com interface web e API FastAPI para inferência dos modelos treinados de saúde foliar (ResNet18), detecção de insetos (YOLO26n) e classificação de recortes de daninhas (ResNet18). O frontend é Next.js/React com TypeScript (mantido no scaffold existente); inferência e persistência permanecem no backend Python.

## Requisitos

- Windows 11, Python 3.11 ou 3.12 e Node.js LTS.
- PyTorch e Torchvision compatíveis entre si e com CPU/CUDA. Escolha a instalação apropriada em https://pytorch.org/get-started/locally/ antes de instalar o restante das dependências.
- Checkpoints originais, nos caminhos `artefatos/classificador_folhas/best_model.pth`, `artefatos/classificador_daninhas/best_model.pth` e `artefatos/detector_insetos/best.pt`.

Os anexos de reconstrução continham diagnósticos, configurações e árvore de caminhos, mas não os arquivos binários dos pesos. Copie os checkpoints originais para estes caminhos antes de usar a inferência. Não são criados resultados substitutos.

## Instalação e execução (CMD)

1. No CMD, crie `backend\.venv` com `python -m venv backend\.venv`.
2. Instale `torch` e `torchvision` nesse ambiente usando o comando indicado pelo seletor oficial para sua variante CPU/CUDA; por exemplo, use `backend\.venv\Scripts\python.exe -m pip install ...` com o comando exibido pelo seletor.
3. Execute `INICIAR.cmd` no Explorador de Arquivos ou no CMD. O script verifica Python, Node.js e PyTorch/Torchvision, instala as dependências Python restantes, inicia API e interface e abre `http://localhost:3000`.
4. Para iniciar separadamente, use `INICIAR_BACKEND.cmd` e `INICIAR_FRONTEND.cmd`; instale antes as dependências e crie os pesos nos caminhos indicados acima.
4. Documentação OpenAPI: `http://localhost:8000/docs`; health: `http://localhost:8000/api/health`.

Para alterar caminhos dos pesos, defina `SOJAO_FOLHAS_WEIGHTS`, `SOJAO_DANINHAS_WEIGHTS` e `SOJAO_INSETOS_WEIGHTS`. A API usa CPU por padrão seguro, seleciona CUDA automaticamente quando `SOJAO_DEVICE=auto` (padrão) e há GPU compatível, ou permite `SOJAO_DEVICE=cpu`/`cuda`. O primeiro carregamento executa smoke test com tensor neutro; isso prova compatibilidade de carregamento/forma de saída, não acurácia. Status `ready` somente é publicado depois desse teste.

## API

- `GET /api/health`
- `GET /api/models/status`
- `POST /api/analyze/folhas` e `/api/analyze/daninhas` — multipart com um ou mais campos `files`.
- `POST /api/analyze/insetos?confidence=0.25&iou=0.45` — multipart `files`; retorna detecções e URL da imagem anotada.
- `GET /api/history?model=&date_from=&date_to=&q=&limit=&offset=`
- `GET /api/history/{id}`

Formatos lidos e verificados pelo conteúdo: JPEG, PNG, WEBP, BMP e TIFF. A orientação EXIF é corrigida e as imagens são convertidas a RGB. O limite padrão é 20 MB por arquivo e 40 milhões de pixels; configure com `SOJAO_MAX_UPLOAD_BYTES` e `SOJAO_MAX_PIXELS`. Arquivos originais existem apenas em memória durante a requisição. SQLite mantém metadados e resultados; imagens anotadas YOLO são persistidas em `dados/resultados` para que os links do histórico permaneçam válidos. Remova periodicamente essa pasta caso deseje uma política de retenção menor.

## Verificação dos modelos e dados

Classes e pré-processamento seguem os metadados anexados: ResNet18, 224×224, `Resize((224,224))`, conversão RGB, normalização ImageNet; classes de folhas `[saudavel, lagarta, vaquinha]`, daninhas `[broadleaf, grass, soil, soybean]`. Os notebooks indicam `torch.save(modelo.state_dict(), best_model.pth)`; carregamento exige correspondência estrita com a ResNet18 e camada final de 3 ou 4 saídas. YOLO usa os 12 nomes/classes registrados e inferência em `imgsz=640`. O classificador de daninhas recebe recortes, não detecta nem segmenta vegetação em cenas inteiras.

As métricas reportadas nos diagnósticos foram medidas em conjuntos de teste: folhas accuracy 93,76% / macro F1 93,01%; daninhas 99,65% / macro F1 99,46%; YOLO mAP50 80,34% / mAP50-95 48,11%, precision 79,02%, recall 77,09%. Não representam garantia de resultado no campo.

## Limitações verificadas neste ambiente de desenvolvimento

O ambiente de geração não contém os checkpoints e usa Python 3.13.17 sem PyTorch, Torchvision ou Ultralytics instalados. Portanto, nenhum modelo pode ser declarado validado/carregado aqui; não foi possível fazer inferência real, testar formatos pelo backend ou confirmar artefato YOLO em execução. A API apresenta cada ausência/falha como indisponível e recusa inferência com HTTP 503. Execute no Windows com os três pesos e dependências para concluir validação de ponta a ponta.
