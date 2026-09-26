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
