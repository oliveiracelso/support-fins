# Fork Dowell

- Upstream `gittrahan/support-fins`; origin `oliveiracelso/support-fins`.
- Publicação autorizada em `https://dowell.etnrlz.com/support-fins/`.
- Usar AWS existente: perfil `celsoetnrlz`, conta `464899062437`, região `us-east-1`.
- Ler `DOWELL.md`; infraestrutura em `../dowell-studio/infra/support-fins.mjs`.
- Não substituir a raiz do painel, não usar Sites e não modificar a impressora.
- Nunca publicar `.local/`, credenciais ou modelos privados nos testes.
- Manter licença/créditos e distinguir defaults upstream de perfis Dowell aprovados.
- Validar com `npx --yes deno@2.9.6 test --allow-read tests/` e conferir o navegador após deploy.
- Histórico autorizado em 26/09/2026: uploads explícitos ao S3 privado com sessão Cognito do Studio. Não afirmar que nenhum arquivo sai do navegador; o envio ocorre ao salvar. Três testes geométricos disponíveis na biblioteca, sem impressão física. Backend/infra no Studio, pacote independente; ler DOWELL.md.
