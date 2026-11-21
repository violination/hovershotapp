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
