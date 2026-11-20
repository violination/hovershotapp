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
