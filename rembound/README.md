# Rembound · laboratório comparativo isolado

## Objetivo
Testar a jogabilidade real do Rembound sem substituir nem modificar o DragonBoundRE, o Hover Shot original, a Hostinger ou o domínio.

## Origem e licença
Código público MIT: https://github.com/remcostoeten/Gunbound, revisão `3e807036f444d006d89050c3f89802ed082d9115` (29/05/2026). Código e assets originais são clonados apenas no build. Inspecionar autoria e licenças dos recursos antes do lançamento.

## Arquitetura planejada
- Web Service Render Free separado, Docker, nome planejado `rembound-lab-mvioli7`; branch `lab/rembound-20261120`; autoDeploy desabilitado.
- Next.js + Bun porta privada 3000; SpacetimeDB local 2.2 e módulo TypeScript `gunbound` porta privada 3002; Nginx público na 10000.
- Somente WebSocket de assinatura `/v1/database/gunbound/subscribe` fica acessível pelo proxy; endpoints administrativos de banco não são expostos. Interface web protegida por BasicAuth com segredo armazenado no Render.
- Banco efêmero: pausa, hibernação ou reinício podem apagar contas e partidas. Nunca usar senhas pessoais.
- Gates: SpacetimeDB publicado, Next HTTP 200, Nginx anônimo 401, autenticado 200 e handshake WebSocket 101.
- Free 512 MiB e franquia de horas compartilhada; capacidade ainda não verificada.
- **Limitação:** o conector Render disponível no ChatGPT não expõe suspend_service/resume_service; proprietário precisa usar a seção de suspensão no dashboard para pausar DragonBoundRE. Não declarar suspenso sem confirmação de `suspended`.
- Sem modificações dos serviços DragonBoundRE `srv-dc0dgosipgvc7390t8gg` e Hover Shot `srv-dc0ctlu7bikc73f56hqg`.
- Separar trabalho planejado, preparado, testado, publicado e aprovado em jogo real.

## Status
Código da infraestrutura preparado em branch separada. Publicação e homologação ainda não verificadas.

## Verificações de implantação — 20/11/2026 (horário de Brasília)

- **Implementado e publicado:** serviço Render `srv-dc0fneek1f9s7390s7u0` (`rembound-lab-mvioli7`), plano Free, região Virginia, URL `https://rembound-lab-mvioli7.onrender.com`, autoDeploy desligado, branch `lab/rembound-20261120`.
- **Código publicado:** SHA `50441b1ba4d74220b3122ea6086ae5f3cf744eb0`, deploy `dep-dc0fov61egvs73fq12og` com estado `live` e evento `deploy_ended=succeeded` em 21/11/2026 02:07:37 UTC. Corrigido sintaxe duplicada no handler KeyA do upstream mediante adaptador; instalado TypeScript no módulo SpacetimeDB antes da compilação.
- **Testes reais no container:** build Next.js 15 bem-sucedido com rotas principais, `REMBOUND_MODULE_PUBLISHED`, `nginx -t` aprovado, acesso sem senha 401 e com senha 200, handshake no endpoint `/v1/database/gunbound/subscribe` respondendo 101, `REMBOUND_WSS_SMOKE_OK`, `REMBOUND_LAB_READY`.
- **Não validado:** partida real no navegador, dois jogadores humanos, persistência após queda, estabilidade de memória com carga, conformidade dos assets para publicação ampla. Não chamar experimento de produção final.
- **Estado da troca:** DragonBoundRE `srv-dc0dgosipgvc7390t8gg` continua reportando `suspended=not_suspended`, sem alterações de código/infraestrutura. O conector Render disponibilizado não tem `suspend_service`. Suspender exige ação no painel Render; depois conferir estado por consulta. Não alterar variáveis ou deploy do DragonBoundRE para simular suspensão.
- **Observação operacional:** banco SpacetimeDB do teste roda localmente no Free e pode perder contas/salas em restart/idle/suspensão; use credenciais descartáveis. Senha de acesso HTTP é armazenada exclusivamente na variável `LAB_PASSWORD` da infraestrutura, nunca neste repositório.

## Incidente de autenticação WebSocket — corrigido em 20/11/2026 (horário de Brasília)

- **Sintoma reproduzido no navegador:** tela de registro com `CONNECTING — TRY AGAIN IN A MOMENT`. O frontend carregava normalmente, mas `GET /v1/database/gunbound/subscribe?compression=Gzip` retornava **HTTP 400** às 02:36:18 UTC de 21/11/2026, impedindo criação de conta. O aviso `SET NEXT_PUBLIC_SPACETIME_AUTH_CLIENT_ID` era somente um placeholder de OIDC opcional.
- **Causa técnica:** a autenticação HTTP Basic do Nginx era encaminhada automaticamente pelo proxy ao endpoint SpacetimeDB. O servidor de banco recebeu `Authorization: Basic ...`, incompatível com seu mecanismo de credenciais. O smoke anterior não enviava esse cabeçalho nem a query `compression=Gzip`, gerando falso positivo **101**.
- **Correção implementada:** o Nginx remove apenas o cabeçalho de autorização `Basic` antes do upstream SpacetimeDB e preserva eventuais credenciais `Bearer`. Continua protegendo a interface por HTTP Basic e restringindo WebSocket ao Origin do laboratório. O adaptador da interface omite apenas o aviso para autenticação externa não configurada; o fluxo de registro por usuário/senha não foi substituído.
- **Regressões obrigatórias adicionadas ao boot:** HTTP anônimo **401**; página autenticada **200**; handshake com `Authorization: Basic`, `?compression=Gzip` e subprotocolos JSON e BSATN **101**; origem estrangeira **403**. O boot aborta se qualquer caso falhar.
- **Falha transitória no primeiro deploy:** teste HTTP disparado antes do Nginx estar pronto (`anon=000DOWN`), embora login já respondesse 200. Corrigido por polling limitado de readiness em `rembound/boot.sh`.
- **Verificado em Render:** commit de correção **`9caa90193e8c3d4058cec5cd67439c95c938bd6a`**, commit de robustez **`5fc123deb12c677e4de9429e02e791c9cfc74273`**, deploy **`dep-dc0g9fuk1f9s7392ga80`** declarado **`live`** às 02:42:20 UTC de 21/11/2026. Logs: `REMBOUND_HTTP_SMOKE_OK anonymous=401 authenticated=200`, `REMBOUND_WS_SMOKE_OK mode=browser-json-basic-auth status=101`, `REMBOUND_WS_SMOKE_OK mode=browser-bsatn-basic-auth status=101`, `REMBOUND_WS_SMOKE_OK mode=foreign-origin-blocked status=403`, `REMBOUND_LAB_READY`.
- **Pendente de homologação humana:** registro de usuário descartável, login, lobby, criação/entrada em sala, jogo 1×1, reconexão e permanência sob carga. O teste WS 101 agora confirma a autorização do handshake real, mas não substitui um teste completo do cadastro.
- **Isolamento:** somente serviço Render `rembound-lab-mvioli7` e sua branch foram alterados. DragonBoundRE e Hover Shot principal permaneceram sem alterações. O DragonBoundRE ainda requer suspensão manual caso esteja ativo; nunca confundir seu estado com o do Rembound.
