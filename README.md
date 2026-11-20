# Hover Shot App — aplicativo web e servidor multiplayer

## Finalidade

Aplicativo de jogo do projeto **Hover Shot**, com backend Node.js/WebSocket no **Render**, separado da home e do catálogo em `https://hovershot.online/` (Hostinger Cloud Startup).

**Estado verificado:** este repositório recebe inicialmente o laboratório `lab-v1` de rede aprovado no repositório `hovershotonline/hovershot`, não um jogo DragonBound completo. A primeira interface comprova autenticação de laboratório, sala de 2, turnos, comandos de tiro sem física e ping/pong. **Não é um clone nem um motor de combate escolhido.**

**Domínio oficial confirmado:** `https://app.hovershot.online/`. A home e o catálogo permanecem em `https://hovershot.online/`. Nenhum DNS foi alterado: o Render fornecerá inicialmente um endereço HTTPS/WSS próprio; depois de verificar o serviço e receber o destino DNS específico, configuraremos o CNAME e o certificado TLS para `app.hovershot.online`.

## Arquitetura

- `server.mjs`: HTTP health e frontend estático com WebSocket `/ws` na mesma origem.
- `public/`: interface em HTML/CSS/JS, responsiva, sem framework pesado.
- `test/`: integração com 2 clientes `ws` locais e testes de segurança.
- `render.yaml`: Web Service Free com segredo aleatório de 256 bits gerado pelo Render (nunca versionado).
- `docs/PRODUTO_CANONICO.md`: objetivos, decisões, limitações e gates.

## Execução local

Requer Node.js 22+. Execute `npm install --ignore-scripts` e `npm test`. Para iniciar `npm start` é obrigatório configurar `LAB_ACCESS_TOKEN` com pelo menos 20 caracteres (segredo em variável de ambiente, nunca no GitHub). Sem o token, o servidor falha fechado.

## Implantação Render

Repositório: `https://github.com/violination/hovershotapp`, branch `main`. O Blueprint em `render.yaml` instala em um único serviço Node, sem Docker ou banco, e gera `LAB_ACCESS_TOKEN` automaticamente. O Render poderá exigir revisão e aprovação explícita do plano de criação.

**Retenção:** salas, nomes e eventos são voláteis em memória; reinícios e hibernação gratuita apagam as salas. O protótipo não armazena mídia, banco ou backup operacional. O código-fonte permanece versionado no GitHub.

## Relação com o outro repositório

O hub original está em `https://github.com/hovershotonline/hovershot`. Não executar o CI/CD nem o deploy Hostinger desse repositório a partir deste app. Antes de integrar links da home, validar endpoint externo e SSL.
