# Hover Shot App — aplicativo web e servidor multiplayer

## Finalidade

Aplicativo de jogo do projeto **Hover Shot**, com backend Node.js/WebSocket no **Render**, separado da home e do catálogo em `https://hovershot.online/` (Hostinger Cloud Startup).

**Estado verificado:** o aplicativo oferece um **MVP original jogável de artilharia** na rota `/`: solo contra CPU e duelo entre duas pessoas, partida por turnos, cálculo de trajetória balística, vento, terreno deformável, dano e vidas. O servidor Render calcula os resultados; o cliente Canvas HTML5 desenha a arena e anima os disparos. O laboratório de rede legado permanece isolado na rota `/lab` e exige segredo próprio. **Não é uma cópia de DragonBound nem um motor de produção completo.**

**Domínio oficial confirmado:** `https://app.hovershot.online/`. A home e o catálogo permanecem em `https://hovershot.online/`. Nenhum DNS foi alterado: o Render fornecerá inicialmente um endereço HTTPS/WSS próprio; depois de verificar o serviço e receber o destino DNS específico, configuraremos o CNAME e o certificado TLS para `app.hovershot.online`.

## Arquitetura

- `server.mjs`: servidor HTTP único, `/healthz`, jogo em `/`, diagnóstico em `/lab`.
- `game/physics.mjs`: simulação balística, colisões, dano, terreno e bot, calculados no servidor.
- `game/network.mjs`: salas públicas temporárias, turnos e WebSocket `/play-ws`.
- `public/`: telas Canvas HTML5 responsivas, sem framework pesado.
- `test/`: testes de física, CPU, multiplayer e limites de segurança.
- `render.yaml`: Web Service Free com segredo aleatório de 256 bits gerado pelo Render (nunca versionado).
- `docs/PRODUTO_CANONICO.md`: objetivos, decisões, limitações e gates.

## Testar imediatamente

- Abra `https://hover-shot-app-dukv.onrender.com/` e clique em **JOGAR AGORA — VS COMPUTADOR**. Não precisa de chave ou cadastro.
- Para jogar contra uma pessoa, clique em **CRIAR SALA**, copie o código de seis caracteres, abra a mesma URL em outro navegador/dispositivo e use **ENTRAR**.
- Use os controles de Ângulo e Potência e clique em **DISPARAR**; no desktop, setas ajustam valores e Espaço atira.
- O plano Free hiberna após inatividade. Salas e partidas são perdidas após reinício/hibernação; não há reconexão persistente.

## Execução local

Requer Node.js 22+. Execute `npm install --ignore-scripts` e `npm test`. Para iniciar `npm start` é obrigatório configurar `LAB_ACCESS_TOKEN` com pelo menos 20 caracteres (segredo em variável de ambiente, nunca no GitHub). Sem o token, o servidor falha fechado.

## Implantação Render

Repositório: `https://github.com/violination/hovershotapp`, branch `main`. O Blueprint em `render.yaml` instala em um único serviço Node, sem Docker ou banco, e gera `LAB_ACCESS_TOKEN` automaticamente. O Render poderá exigir revisão e aprovação explícita do plano de criação.

**Retenção:** salas, nomes e eventos são voláteis em memória; reinícios e hibernação gratuita apagam as salas. O protótipo não armazena mídia, banco ou backup operacional. O código-fonte permanece versionado no GitHub.

## Relação com o outro repositório

O hub original está em `https://github.com/hovershotonline/hovershot`. Não executar o CI/CD nem o deploy Hostinger desse repositório a partir deste app. Antes de integrar links da home, validar endpoint externo e SSL.
