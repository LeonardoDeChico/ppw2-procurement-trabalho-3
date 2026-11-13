# AI-LOG — Registro de prompts, respostas e refatorações

Ferramenta: **Claude (Anthropic)**, usada no editor com acesso ao repositório (trabalhos 1 e 2 e enunciado).
Análise detalhada de cada decisão, com o código bruto da IA e o código final: [`docs/ai-decisions.md`](docs/ai-decisions.md).

## Como a IA foi usada

| Etapa | Uso da IA | Papel do aluno |
| ----- | --------- | -------------- |
| Leitura do enunciado | resumo dos requisitos do projeto 11 | conferir com a matriz de complexidade |
| Modelagem do banco | sugestão de tabelas e constraints | simplificar alçadas, exigir histórico imutável |
| Máquina de estados | proposta de padrão State | trocar por matriz de transições + guardas |
| Implementação | geração de código das camadas | revisar, testar e corrigir |
| Testes | script de teste da API | definir os cenários de regra de negócio |
| Documentação | rascunho do README e diagramas | revisar e ajustar à implementação final |

## Linha do tempo

| # | Prompt (resumo) | Resposta da IA | Problema | Refatoração | Commit |
| - | --------------- | -------------- | -------- | ----------- | ------ |
| 1 | Ler os trabalhos 1 e 2 e o enunciado e propor a evolução, de forma simples de explicar na arguição | trocar JSON por SQLite e manter as camadas | — | aceito | `chore`, `feat(db)` |
| 2 | Modelar alçadas sem hardcode de ids | faixas com mínimo/máximo + `papel_exigido` | sobreposição e ambiguidade em 5.000 | só `valor_minimo` + `solicitante_pode_aprovar` | `feat(db)` |
| 3 | Máquina de estados com OCP/SRP/LSP | State pattern, 7 classes | RBAC espalhado, erros genéricos | matriz `TRANSICOES` + interface `Guarda` | `feat(domain)` |
| 4 | Reiniciar aprovação em ajuste/cancelamento | `DELETE FROM aprovacoes` | perde auditoria, fora de transação | coluna `ativa` + índice único parcial | `feat(db)`, `feat(app)` |
| 5 | Transação status + histórico | transação `async` com `BEGIN` | `await` intercala requisições | `BEGIN IMMEDIATE` síncrono + lock otimista | `feat(shared)`, `feat(infra)` |
| 6 | Listagem com contagem e valor | `buscarPorId` por linha | N+1 | uma query com JOIN + GROUP BY | `feat(infra)` |
| 7 | Filtro de erros HTTP | procura `UNIQUE` na mensagem já traduzida | **500 em vez de 409** (achado no teste) | compara a mensagem original | `feat(shared)` |
| 8 | Tela de detalhe | mensagem de erro no topo | erro fora da tela ao clicar em botões no fim | rolar para o topo após cada ação | `feat(web)` |
| 9 | Reaproveitar `node_modules` do trabalho 1 | copiar a pasta | build quebrado | `npm ci` limpo | — |

## Verificação

- `npm run test:api`: 34 verificações (400, 401, 403, 404, 409, 422, alçada de 2 gestores, teto, ajuste, cancelamento, OC).
- Direto no banco: `UPDATE`/`DELETE` em `historico_status` bloqueados por trigger; FK e CHECK recusam dados inválidos.
- Fluxo completo no navegador trocando de usuário pelo seletor do topo.
