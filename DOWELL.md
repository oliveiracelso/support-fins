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

O fork mantém os parâmetros geométricos do projeto original. Eles não são
um perfil de impressão aprovado para o bico 1,6 mm da Dowell. O botão
**← Dowell** volta ao painel; o botão GitHub abre este fork.

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

O script valida a conta, a stack, o domínio e o hash autorizado. Envia somente
`web/` para o prefixo `support-fins/`, sem apagar o painel. Registra a publicação
em `.local/deployment.json`, fora do Git. O MIME do WebAssembly é explícito.

`/support-fins` redireciona para `/support-fins/`, que serve o index da ferramenta.
O dashboard e `/api/*` mantêm as políticas anteriores. Somente a resposta do
worker STEP permite a execução dinâmica exigida pelo Emscripten; a página
principal mantém scripts restritos à própria origem e ao hash do import map.

Os helpers dos testes foram corrigidos para caminhos Windows usando URLs de
arquivo e `fileURLToPath`; o motor de geometria permanece igual ao upstream.

## Reversão

O upload da ferramenta é independente do painel. Para retirar o acesso,
remova o link do menu e os behaviors definidos por `addSupportFins` na stack.
Para reverter uma versão da ferramenta, volte ao commit anterior no fork,
atualize a infraestrutura se o import map mudar e execute o mesmo script.
Não faça `sync --delete` na raiz do bucket.
