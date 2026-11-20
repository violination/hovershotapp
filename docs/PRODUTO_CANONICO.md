# Hover Shot App — produto canônico

## Finalidade
O jogo próprio Hover Shot será executado no navegador, com multiplayer online. Esta aplicação Node.js/WebSocket será hospedada no Render, separada da home do catálogo permanente em hovershot.online (Hostinger). O repositório de app é violination/hovershotapp; o catálogo continua versionado independentemente em hovershotonline/hovershot.

## Estado da implementação
- **Implementado:** MVP de artilharia original em `/` (solo contra CPU e 1×1 por código), HTML5 Canvas, física balística autoritativa no Render, vento, impacto, dano, HP, terreno deformável, vitória/derrota e revanche; endpoint WebSocket `/play-ws` com origem restrita, limites de mensagens e salas efêmeras. Laboratório WebSocket lab-v1 isolado em `/lab` e `/ws`, com segredo próprio, preservado; saúde em `/healthz`.
- **Ainda NÃO implementado:** equivalência com DragonBound, motor definitivo, sprites sofisticados, física e balanceamento avançados, autenticação individual, reconexão persistente, matchmaking público, banco/ranking e domínio personalizado ativo.
- **Não autorizado:** incorporar código, sprites ou marca DragonBound de origem proprietária; o feedback de gameplay serve como referência.

## Decisões
1. Render foi selecionado para o runtime Node.js e WebSocket, começando no plano Free em ambiente de homologação.
2. Cloud Startup mantém o catálogo e jogos atuais, sem duplicação de componentes operacionais ou repositórios de mídia.
3. Segurança: LAB_ACCESS_TOKEN gerado no Render por generateValue: true; nunca versionar credenciais. Token compartilhado de laboratório deve ser substituído por login e tickets de curta validade antes de produção.
4. A experiência de gameplay será escolhida após homologação, sem assumir que a infraestrutura aprova um motor.
5. As salas são temporárias em memória e se perdem em reinícios e hibernação. O plano Free é somente para testes.
6. **Domínio oficial confirmado pelo proprietário em 20/11/2026: `app.hovershot.online`.** O jogo ficará neste subdomínio, enquanto `hovershot.online` mantém a home e o catálogo. Esta decisão não configura DNS automaticamente: o CNAME e HTTPS/WSS só serão ativados após criação de um Web Service real no Render e obtenção do destino DNS exato apresentado pelo provedor.

## Testes e checkpoints
- Fonte migrada do laboratório de hovershotonline/hovershot, aprovado em CI 44826886870, com 4/4 testes locais WS.
- Criar CI independente neste repositório e repetir a suíte após a migração.
- Provisionar Render via Blueprint do repositório; validar /healthz, /lab, HTTPS e WSS entre duas redes; só depois adicionar domínio.
- Registrar URL real, SHA implantado, configuração DNS verificada e testes remoto humano, sem registrar segredos.

## Eficiência operacional
Uma única instância Web Service com WS, sem Redis/MySQL para o laboratório; salas expiram ao perder último membro, heartbeat de 30 s e limites de mensagens. Código e decisões no GitHub. Nenhum arquivo de sessão/backups persistente no Render. Crescimento futuro requer autenticação, persistência e medição de carga.

## Execuções verificadas em 20/11/2026

- Código do laboratório migrado ao repositório violination/hovershotapp na main; teste do GitHub Actions [44830553226](https://github.com/violination/hovershotapp/actions/runs/44830553226) concluído com sucesso.
- Conta Render conectada: workspace Oliver's workspace (tea-dc0c7gc0916s73dauobg). Antes do provisionamento, list_services retornou vazio.
- Blueprint criado como **plano**: identificador exs-dc0cnoec6qcc739nd5qg, repositório e branch corretos, autoSync habilitado. **Planejamento falhou**: Render devolveu `planningOutcome=failed` com `need_payment_info` no serviço; `sync=null`. Nenhum Web Service implantado, domínio ou DNS modificado. Não declarar aplicação online até revisão e aprovação de um novo plano válido.
- **Domínio confirmado pelo proprietário: `app.hovershot.online`**, retificando a grafia `app.hovershor.online`. O código já permite essa origem; DNS e certificado ainda pendentes de provisionamento real no Render.

## Publicação Render verificada em 20/11/2026

- Proprietário aprovou expressamente a criação do serviço Web Service **Free**.
- Blueprint de Render `exs-dc0cnoec6qcc739nd5qg` aprovado, sync `exe-dc0csl2fngtc738o4a7g` aplicado.
- Serviço criado: `srv-dc0ctlu7bikc73f56hqg`, slug `hover-shot-app-dukv`, URL atribuída `https://hover-shot-app-dukv.onrender.com`.
- Primeira publicação no SHA `64602bff6fe0d698e5d7912bd89baedeff2abae2`, deploy `dep-dc0ctme7bikc73f56j50`, estado Render **live** e evento `deploy_ended=success`, após `build_ended=success`. Logs: `HOVER_SHOT_NETWORK_LAB_READY port=10000` e `Your service is live`.
- Infraestrutura configurada: Node.js 24, Web Service gratuito, região Virginia, health `/healthz`, WSS `/ws`, interface de homologação `/lab`, segredo gerado na infraestrutura (`LAB_ACCESS_TOKEN`, não registrado em código).
- **Ainda pendente:** teste HTTP externo de `/healthz` e `/lab`; teste WSS de ponta a ponta em dois navegadores; adição/verificação do domínio personalizado `app.hovershot.online` e certificado TLS. Não declarar esses passos concluídos sem prova.
- **Observação:** documentação não altera nem prepara DNS na Hostinger. A home e o catálogo não foram modificados pelo provisionamento.
