# Hover Shot App · Roadmap canônico

## Objetivo
Criar jogo de artilharia original, jogável no navegador em Render: física balística, terreno, vida, turnos, vento e partidas online entre duas pessoas. Interface imersiva, pronta para testes sem domínio customizado ou chave de laboratório. Não reutilizar imagens, código ou arte proprietária de DragonBound/GunBound.

## Decisão 2026-11-20 — MVP jogável
- **Decidido:** transformar a raiz `/` de hovershotapp em jogo de artilharia funcional e gratuito para visitantes, mantendo `/lab` e o legado WebSocket autenticado `/ws` sem regressões.
- **Decidido:** modos solo contra CPU e 1x1 por código. Servidor Render controla a física, o turno, dano, terreno e resultado; cliente apenas desenha, envia ângulo/força e anima eventos. Sem banco e sem armazenamento de partidas no plano Free.
- **Decidido:** WebSocket público do jogo separado (`/play-ws`), sem segredo de laboratório, com checagem de origem, limites de mensagens, sessões por socket e limpeza automática de salas vazias.
- **Decidido:** experiência própria original, sem dependência de imagens de terceiros, renderização HTML5 Canvas. Portal principal na Hostinger não será alterado.
- **Implementado no GitHub:** arena Canvas, mira, potência, trajetória, colisões, deformação do terreno, HP, vento, CPU, duas pessoas por sala WebSocket, HUD responsivo, teclado/controles touch via sliders, revanche e testes automatizados.
- **Verificado:** GitHub Actions da revisão `6058c6401fb3cf903b3e669fb80748236ed043bd` aprovado no workflow `44834794477`, incluindo o novo teste de partida solo com resposta da CPU e os testes 1×1. Validação de publicação Render e smoke externo devem ser registradas separadamente.
- **Gate de entrega:** CI aprovado, deploy Render `live`, `/healthz` e raiz acessíveis; confirmar WebSocket com testes e não afirmar teste humano que não ocorreu.

## Posteriores, ainda não implementados
- Itens/personagens/balanço, física mais profunda, acerto com colisão precisa, mapas, contas e autenticação, reconexão e ranking, fila/escala, matchmaking e economia.
- Domínio `app.hovershot.online` confirmado pelo proprietário, mas DNS adiado pelo proprietário para priorizar teste de jogo.

## Operação
Código e histórico no GitHub `violination/hovershotapp`; hospedagem única Render Free; logs temporários apenas na plataforma; salas efêmeras sem persistência. Versões futuras exigem revisão de custo/capacidade/segurança.

## DragonBoundRE — laboratório isolado (solicitação de 20/11/2026)
- **Decisão do proprietário:** instalar e testar o código do projeto público `DragonBoundR/DragonBound` antes de decidir se será base do jogo definitivo. Não substituir o Hover Shot que já está online.
- **Verificado no upstream:** revisão `5e42cb4c6901b0ab16dcdb5dfd38474c7373b33a`, 5.192 arquivos e ~470,7 MB de blobs, processos Node de web e game, MySQL obrigatório, porta WebSocket interna 9001, porta web 80 e SQL inicial de ~2,1 MB. Nenhum arquivo LICENSE independente foi encontrado na raiz; `package.json` declara ISC, mas não verifica direitos sobre imagens/áudios.
- **Plano:** experimento isolado em ramo `lab/dragonboundre-20261120`; Docker cria MariaDB transitório e dois processos Node, proxy público em uma porta HTTPS/WSS, bloqueio de endpoints administrativos, alterações mínimas e reversíveis, código upstream clonado por SHA durante o build sem copiar assets para o GitHub do projeto.
- **Status:** implementação exploratória, **NÃO afirmar que DragonBoundRE está instalado ou jogável** sem build, startup, HTTP e WS completos. Render Free tem 512 MB RAM, CPU limitada, sistema de arquivos volátil, 750h/mês compartilhadas e 5 GB de bandwidth incluído: risco de OOM, reinício e cobrança excedente de bandwidth.
- **Restrições:** não expor dados pré-existentes de contas do dump SQL; não utilizar credenciais públicas fixas; limitar caminhos inseguros e acesso externo. Sem migrar pagamentos, usuários ou dados do projeto Hover Shot; rollback é excluir o serviço de laboratório.

## DragonBoundRE — implantação verificada em 20/11/2026
- **Infraestrutura criada sem substituir o Hover Shot existente:** Web Service Render `srv-dc0dgosipgvc7390t8gg`, nome `dragonboundre-lab-mvioli7`, instância **Free**, região Virginia, URL `https://dragonboundre-lab-mvioli7.onrender.com/`, painel `https://dashboard.render.com/web/srv-dc0dgosipgvc7390t8gg`; deploy automático desabilitado para evitar mudanças inesperadas.
- **Código aplicado:** upstream fixado no SHA `5e42cb4c6901b0ab16dcdb5dfd38474c7373b33a` diretamente no Docker durante build, adaptadores neste ramo `lab/dragonboundre-20261120`; infraestrutura sem importação de contas/mensagens antigas.
- **Falhas observadas e correções:** erro 1064 com INSERT SQL multiline corrigido com parser; reinicialização do DB efêmero corrigida; OOM confirmado em revisão antiga por limite 512 MiB; processos Node e buffers otimizados; mapas originais carregados sob demanda com cache de dois mapas, buffers RGBA compactos; global `Map` indevidamente sobrescrito pelo upstream restaurado; portas web 8080 e game 9001 presas a localhost, Nginx privado exposto na 10000.
- **Verificação real do Render:** deploy `dep-dc0dptttv6ss73eur8og`, SHA `93e3668ce4857537544c37acf86d6dfd4f655d75`, estado `live` às 23:51:57Z. Logs de execução `DATABASE_SANITIZED_INITIALIZED`, `DRAGONBOUNDRE_UPSTREAMS_OK web=200 game=200`, `DRAGONBOUNDRE_LAB_READY web=200 game=200 port=10000`. Testes de HEAD/GET na raiz sem autenticação deram **HTTP 401 esperado**, confirmando a barreira de acesso básica.
- **Ainda pendentes:** acesso autenticado externo com navegador real, registro temporário, login, conexão WebSocket com cliente HTML5 e partida completa entre dois jogadores. O proxy `live` e os upstreams HTTP 200 **não atestam** a jogabilidade final; o usuário atuará como testador após a entrega do link.
- **Segurança:** senha básica de laboratório é variável de ambiente apenas no Render; nunca registrar credenciais em GitHub. Não reutilizar senha real nem dados pessoais de contas antigas. Auditoria completa de código/arte/direitos, autenticação e URLs externas necessária antes de lançamento público. Bloqueio parcial de rotas perigosas não representa revisão de segurança total.
- **Persistência:** banco MariaDB é recriado do zero no início e salas/contas são descartadas em reinício/hibernação. Não usar para dados permanentes ou tráfego público. Hostinger e hub Hover Shot não foram alterados.
- **Custos e capacidade:** plano Free com 512 MiB e CPU limitada é adequado apenas ao teste inicial. Logs antigos reportam até 900 jogadores por mundo, mas é configuração de código sem teste de carga e **não** comprova capacidade real da instância Render. Custos recorrentes e capacidade definitiva ficam para decisão posterior.

## DragonBoundRE — correção de HTTP 500 na autenticação (20/11/2026)
- **Bug reproduzido em produção de laboratório:** após informar usuário `test`, Nginx devolvia HTTP 500. O log real às 23:54:10 UTC mostra `open() "/tmp/dragonboundre_htpasswd" failed (13: Permission denied)` com GET autenticado 500.
- **Causa confirmada:** `boot.sh` criava arquivo htpasswd com `umask 077` (permissão 600/root). Worker Nginx não podia ler esse arquivo; requisições sem credencial retornavam 401, mascarando o problema durante o preflight anterior.
- **Implementado:** grupo `www-data` e permissão `0640` em `/tmp/dragonboundre_htpasswd`, worker `user www-data;` no `nginx.conf`. Permissão restrita, sem tornar o hash publicamente legível. Adicionado smoke autenticado ao startup, falhando fechado se `anonymous != 401`, `authenticated != 200` ou `CSS != 200`.
- **Verificado:** GitHub commits `7e8b91fcd623a553a4ac6aa7c95db619ae00b891` e `2ea27c451cd401a33285962ddd459b75ef89bc6c`. Render deploy `dep-dc0ds5brjlhs73d4n3l0`, estado `live` às 23:56:39 UTC. Logs às 23:56:46 UTC: `DRAGONBOUNDRE_UPSTREAMS_OK web=200 game=200`, GET sem credencial HTTP 401, GET autenticado `/` HTTP 200 (86.322 bytes), GET autenticado `/static/css/ThorBound.min.css` HTTP 200 (280.891 bytes), `AUTHENTICATED_HTTP_SMOKE_OK anonymous=401 authenticated=200 static=200` e `DRAGONBOUNDRE_LAB_READY`.
- **Pendente:** conferir resposta HTTPS autenticada em navegador e fluxo de cadastro/lobby/partida humana real. Não considerar smoke HTTP suficiente para aprovar jogabilidade.
