# Support Fins no Dowell Studio

Fork: https://github.com/oliveiracelso/support-fins

Aplicação: https://dowell.etnrlz.com/support-fins/

Origem: https://github.com/gittrahan/support-fins, commit `188f224`.
A licença MIT e os créditos do projeto original foram preservados. As licenças
do OpenCascade e demais dependências permanecem em `web/vendor/`.

## Uso

No Dowell Studio, abra **Support Fins** no menu. Importe STL, 3MF ou STEP,
ajuste a orientação, gere os suportes e exporte STL ou 3MF para o fatiador.
O processamento dos modelos acontece no navegador. O aplicativo estático é
acessível pelo link direto; a API privada do painel mantém sua autenticação.
Não há conexão desta ferramenta com os comandos da impressora.

O perfil padrão agora é **Dowell DL1824-16**, mesa **1800 × 2400 mm** e altura
**1600 mm**, bico **1,6 mm**, linha nominal **1,6 mm**, linha inicial **1,9 mm**,
primeira camada **0,5 mm** e demais **0,6 mm**. O botão **← Dowell** volta ao painel.

As dimensões de máquina e processo vêm dos perfis locais atuais e do registro
`diagnostico-impressora/2026-09-26-cenarios-dowell/configuracoes-teste-base.json`
do projeto Dowell. A área de sondagem não foi confundida com o volume imprimível.
O zero físico, temperaturas, velocidades e perfis do OrcaSlicer não são modificados.

## Geometria adaptada — 26/09/2026

- Dentes com uma linha de **1,6 mm**; paredes de **3,2 mm** e ponta de **1,6 mm**.
- Dentes alinhados a **0,5 + n × 0,6 mm**, respeitando a primeira camada distinta.
  Mesma regra em Auto, paredes desenhadas, cunhas e escoras laterais.
- Bases e pad Light com **0,5 mm**; abas calculadas pela linha inicial de 1,9 mm.
  Vazados preservam travessas de pelo menos 3,2 mm. Escoras variam de 3,2 a 4,8 mm.
- Folga candidata PLA **0,6 mm**, PETG **0,8 mm**; pad Light com folga lateral
  **0,3 mm**. Mordida PLA **1,2 mm**, PETG **0,6 mm**. São candidatos geométricos:
  desprendimento, aderência e estabilidade ainda dependem de amostra física.
- Alturas editáveis de 0,1 a 0,8 mm, lembradas neste navegador. A primeira camada
  aprovada não significa aprovação física dos novos suportes.
- Volume Dowell inicial usa uma chave nova de preferências, sem reaproveitar
  silenciosamente a mesa pequena salva pela versão anterior. Volume personalizado
  aceita dimensões de 20 a 5000 mm; a verificação inclui os suportes adicionados.
- STL e 3MF contêm geometria em milímetros; não incluem perfil do fatiador.
  Usar as mesmas alturas constantes no OrcaSlicer e conferir regiões descobertas.
- Exportação indisponível durante edição, espera e geração dos suportes, ou
  com camada inválida. Resposta de um cálculo antigo não libera a exportação.

Nenhum teste físico foi iniciado. Antes de uma peça grande, validar uma amostra
com a mesma combinação de material, alturas de camada e folgas.

## Implantação

O ambiente existente usa AWS S3 privado e CloudFront, gerenciados pela stack
`DowellStudio-prod`, perfil `celsoetnrlz`, região `us-east-1`. A infraestrutura
continua em `../dowell-studio/infra/`, incluindo `support-fins.mjs`.

1. Mantenha os checkouts `support-fins` e `dowell-studio` lado a lado.
2. Valide com `npx --yes deno@2.9.6 test --allow-read tests/`.
3. Se mudar a infraestrutura ou o import map do HTML, execute o deploy do
   Dowell Studio antes do upload. A política CSP usa o hash exato do import map.
4. Execute `node scripts/deploy-dowell.mjs` nesta pasta.
5. Aguarde a invalidação e confira importação, geração e exportação no navegador.
   Execute `node scripts/verify-dowell.mjs` para conferir bytes dos arquivos,
   cabeçalhos CSP/MIME, redirecionamento e acesso anônimo negado à API do painel.

O script valida a conta, a stack, o domínio e o hash autorizado. Envia somente
`web/` para o prefixo `support-fins/`, sem apagar o painel. Registra a publicação
em `.local/deployment.json`, fora do Git. O MIME do WebAssembly é explícito.

`/support-fins` redireciona para `/support-fins/`, que serve o index da ferramenta.
O dashboard e `/api/*` mantêm as políticas anteriores. Somente a resposta do
worker STEP permite a execução dinâmica exigida pelo Emscripten; a página
principal mantém scripts restritos à própria origem e ao hash do import map.

Os helpers dos testes usam URLs de arquivo e `fileURLToPath` para Windows.
O perfil é enviado explicitamente ao worker; chamadas sem perfil mantêm os
parâmetros upstream iniciais. O motor também é usado pelas paredes manuais.

## Reversão

O upload da ferramenta é independente do painel. Para retirar o acesso,
remova o link do menu e os behaviors definidos por `addSupportFins` na stack.
Para reverter uma versão da ferramenta, volte ao commit anterior no fork,
atualize a infraestrutura se o import map mudar e execute o mesmo script.
Não faça `sync --delete` na raiz do bucket.

## Validação de 26/09/2026

- 155 testes do Support Fins e 43 testes do Dowell Studio aprovados.
- 49 arquivos publicados conferidos byte a byte, com CSP, MIME WebAssembly e
  redirecionamento corretos. Dashboard responde e API rejeita acesso anônimo.
- No navegador de produção: `bracket.step` importado com 1.044 triângulos,
  dimensões 40 × 20 × 30 mm, dois suportes gerados, sem erros no console.
- STL e 3MF baixados e validados: ambos com 1.836 triângulos; 3MF em milímetros.
- Registros locais em `.local/verification.json`, `.local/browser-verification.json`
  e `.local/deployment.json`. Nenhuma impressão física foi executada.

Na adaptação: **161 testes aprovados**, incluindo seis novos testes de dimensões,
grade de camadas, Auto/cunhas, pad, paredes manuais e escoras. No navegador local,
um modelo de 300 × 180 × 300 mm gerou 15 suportes; exportação bloqueada durante
recálculo. Campo de camada inválido também bloqueia a saída.

Publicação da adaptação: commit `58add86`, 51 arquivos conferidos byte a byte,
invalidação CloudFront concluída. Em produção, STL e 3MF com 64.700 triângulos
(20 da peça + 64.680 dos suportes), sem erro de console. Os 194.040 vértices
exportados dos suportes coincidem com o cálculo independente do perfil Dowell,
diferença máxima de 0,0000062 mm por arredondamento Float32.
Registro: `.local/adaptation-browser-verification.json`.

## Histórico privado e testes — 26/09/2026

**Histórico e testes** abre a biblioteca e três peças de validação: placa de
60 × 40 × 6,4 mm a 45°, balanço de 60 × 32 × 40,1 mm e torre de
24 × 24 × 100,1 mm. Gerar carrega o modelo e cria suportes; não fatia nem imprime.
Comparar uma variável por vez: grip leve/médio/firme na placa; folga
0,4/0,6/0,8 mm no balanço; escoras na torre após validar os modelos pequenos.

**Salvar no histórico** envia uma versão explicitamente para a AWS. Importar,
calcular ou baixar localmente continua sem enviar o modelo. Cada versão guarda
malha original normalizada em `source.stl`, resultado em STL e 3MF e um
`project.json` com orientação, parâmetros, volume, paredes manuais e remoções.
O arquivo CAD original e seus metadados não são arquivados; a malha pode ser
reaberta para editar. Um novo salvamento não substitui a versão anterior.

A biblioteca é compartilhada entre usuários autenticados do mesmo Dowell Studio.
Usa a sessão Cognito existente, bucket S3 próprio privado e versionado, tabela
DynamoDB com índice por data e uma Lambda independente. Não acessa a impressora,
câmeras ou segredos de outros serviços. Resultados físicos podem ser registrados
como ainda não testado, aprovado, precisa de ajuste ou falhou, com observações.

Uploads vão diretamente ao S3 com URLs temporárias, tamanho assinado, SHA-256 e
`If-None-Match: *`. A API confere tamanho/checksum dos quatro arquivos antes de
exibir a versão. Retentativas mantêm o mesmo ID e conteúdo. Downloads exigem
login para emitir URLs válidas por cinco minutos. Até 100 MB por arquivo,
256 KB de parâmetros e 250 MB no conjunto. Não há exclusão automática do histórico.

Infra/API no projeto irmão `dowell-studio`: `infra/support-fins-library.mjs`,
`backend/support-fins.mjs` e `backend/support-fins-service.mjs`.
Antes de publicar a stack, executar `node scripts/build-support-fins-backend.mjs`.
Esse pacote é independente do backend de monitoramento. Os outputs da stack
incluem `SupportFinsBucket`, `SupportFinsTable` e `SupportFinsFunction`.
O CSP permite conexão somente com a própria origem e o bucket específico.

Validação automatizada: 164 testes do motor e 62 testes do Studio aprovados.
Os novos testes cobrem geometria fechada/escala dos modelos, bloqueio anônimo,
origem de gravações, limites, checksum, envio incompleto e retentativa idempotente.
