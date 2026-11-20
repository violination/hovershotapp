# Hover Shot App — produto canônico

## Finalidade
O jogo próprio Hover Shot será executado no navegador, com multiplayer online. Esta aplicação Node.js/WebSocket será hospedada no Render, separada da home do catálogo permanente em hovershot.online (Hostinger). O repositório de app é violination/hovershotapp; o catálogo continua versionado independentemente em hovershotonline/hovershot.

## Estado da implementação
- **Implementado:** laboratório de WebSocket lab-v1, interface HTML5 em /lab, endpoint de saúde /healthz, WebSocket /ws, senha do laboratório, criação de sala para dois, trocas de turnos, comandos de tiro de rede, ping/pong, controle de origem e limites.
- **Ainda NÃO implementado:** jogo DragonBound, engine definitiva, física balística, vento, tiros com dano, terrenos, login individual, persistência de partidas, matchmaking público e domínio personalizado ativo.
- **Não autorizado:** incorporar código, sprites ou marca DragonBound de origem proprietária; o feedback de gameplay serve como referência.

## Decisões
1. Render foi selecionado para o runtime Node.js e WebSocket, começando no plano Free em ambiente de homologação.
2. Cloud Startup mantém o catálogo e jogos atuais, sem duplicação de componentes operacionais ou repositórios de mídia.
3. Segurança: LAB_ACCESS_TOKEN gerado no Render por generateValue: true; nunca versionar credenciais. Token compartilhado de laboratório deve ser substituído por login e tickets de curta validade antes de produção.
4. A experiência de gameplay será escolhida após homologação, sem assumir que a infraestrutura aprova um motor.
5. As salas são temporárias em memória e se perdem em reinícios e hibernação. O plano Free é somente para testes.
6. Domínio pretendido: **app.hovershot.online** (interpretação de app.hovershor.online, aguardando confirmação do proprietário), sem alteração de DNS antes dessa confirmação. A etapa de domínio exige provisionamento do serviço, CNAME e TLS ativo.

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
- O proprietário digitou `app.hovershor.online`, diferente do domínio já usado `hovershot.online`. O código contempla `app.hovershot.online` como hipótese, mas a zona DNS deve aguardar confirmação expressa.
