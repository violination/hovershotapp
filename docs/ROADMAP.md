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
