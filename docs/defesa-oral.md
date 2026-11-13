# Roteiro para a Arguição Técnica (Defesa Oral)

Objetivo: saber **explicar o caminho de uma requisição HTTP**, o **ciclo de vida** da requisição de compra,
as **queries executadas** e fazer **pequenas alterações ao vivo**.

Dica: deixe o backend rodando com `npm run start:dev` no terminal. Cada query aparece com o prefixo `[SQL]`,
então dá para mostrar ao professor exatamente o que o banco executou.

---

## 1. O caminho de uma requisição HTTP (exemplo: aprovar)

O usuário Diego (GESTOR) clica em **✔ Aprovar** na tela de detalhe.

| # | Onde | O que acontece |
| - | ---- | -------------- |
| 1 | `web/src/app/requisicao/[id]/page.tsx` → `aoExecutar('aprovar')` | o botão chama `executarAcao()` |
| 2 | `web/src/lib/requisicoes.ts` → `chamar()` | `fetch POST http://localhost:8000/procurement/requisicoes/1/aprovar` com o cabeçalho `x-usuario-id: 4` e o corpo `{ justificativa }` |
| 3 | `server/src/main.ts` | o Nest recebe; o CORS libera o front (porta 3000) |
| 4 | `presentation/requisicao.controller.ts` → `aprovar()` | `ParseIntPipe` converte o id; `usuarioObrigatorio()` lê o cabeçalho (sem ele → 401) |
| 5 | `application/fluxo-aprovacao.service.ts` → `aprovar()` → `executar()` | abre a **transação** e orquestra os passos |
| 6 | `infrastructure/requisicao.sqlite.repository.ts` | faz os SELECTs (requisição, cotações, aprovações, ordem, usuário, alçada) |
| 7 | `domain/maquina-estados/maquina-estados.ts` → `transicionar()` | valida: status permitido? papel permitido? justificativa? guardas? Devolve o novo status |
| 8 | `fluxo-aprovacao.service.ts` (efeito) | `INSERT INTO aprovacoes` |
| 9 | repositório → `atualizarStatus()` | `UPDATE requisicoes ... WHERE id = ? AND status = ?` (lock otimista) |
| 10 | repositório → `registrarHistorico()` | `INSERT INTO historico_status` (auditoria) |
| 11 | `shared/infrastructure/database/banco.ts` → `transacao()` | `COMMIT` (ou `ROLLBACK` se algo lançou erro) |
| 12 | `requisicaoService.detalhar()` | relê tudo e devolve JSON com `acoesDisponiveis` e `historico` |
| 13 | se deu erro | `shared/presentation/erro-http.filter.ts` converte o erro em 400/401/403/404/409/422 e o front mostra `message` |

### Queries reais dessa chamada (copiadas do terminal)

```sql
BEGIN IMMEDIATE
SELECT r.*, u.nome AS solicitante_nome, u.papel AS solicitante_papel FROM requisicoes r JOIN usuarios u ON u.id = r.solicitante_id WHERE r.id = ?            [1]
SELECT id, fornecedor, valor_unitario, prazo_dias, observacao, registrada_em FROM cotacoes WHERE requisicao_id = ? ORDER BY id                              [1]
SELECT a.id, a.justificativa, a.aprovada_em, u.id AS aprovador_id, u.nome, u.papel FROM aprovacoes a JOIN usuarios u ON u.id = a.aprovador_id
       WHERE a.requisicao_id = ? AND a.ativa = 1 ORDER BY a.id                                                                                             [1]
SELECT id, numero, cotacao_id, valor_total, emitida_em FROM ordens_compra WHERE requisicao_id = ?                                                          [1]
SELECT id, nome, papel FROM usuarios WHERE id = ?                                                                                                          [4]
SELECT * FROM alcadas WHERE valor_minimo <= ? ORDER BY valor_minimo DESC LIMIT 1                                                                           [10500]
INSERT INTO aprovacoes (requisicao_id, aprovador_id, justificativa) VALUES (?, ?, ?)                                                                       [1,4,"Preço ok"]
UPDATE requisicoes SET status = ?, atualizada_em = ... WHERE id = ? AND status = ?                                                                         ["APROVADA",1,"AGUARDANDO_APROVACAO"]
INSERT INTO historico_status (requisicao_id, estado_anterior, novo_estado, acao, autor_id, justificativa) VALUES (?, ?, ?, ?, ?, ?)                         [1,"AGUARDANDO_APROVACAO","APROVADA","aprovar",4,"Preço ok"]
COMMIT
-- depois do COMMIT, os SELECTs do detalhar() para devolver a resposta
```

Todos os valores vão como **parâmetros `?`** (prepared statements), nunca concatenados no SQL → sem SQL injection.

### Queries das outras rotas

| Rota | Queries principais |
| ---- | ------------------ |
| `GET /requisicoes` | **1 query**: `requisicoes JOIN usuarios LEFT JOIN cotacoes GROUP BY r.id` (conta cotações e calcula o valor sem N+1) |
| `GET /requisicoes/:id` | 4 SELECTs da requisição + usuário + alçada + histórico |
| `POST /requisicoes` | transação: `INSERT INTO requisicoes` + `INSERT INTO historico_status (NULL → ABERTA)` |
| `PUT /requisicoes/:id` | transação: SELECTs para validar + `UPDATE requisicoes SET titulo = ?, ...` |
| `POST /:id/cotacoes` | transação: SELECTs + `INSERT INTO cotacoes` (UNIQUE de fornecedor no banco) |
| `POST /:id/solicitar-ajuste` e `/cancelar` | `UPDATE aprovacoes SET ativa = 0` + `UPDATE requisicoes` + `INSERT historico_status` |
| `POST /:id/ordem-compra` | `INSERT INTO ordens_compra` + `UPDATE requisicoes` + `INSERT historico_status` |

---

## 2. Ciclo de vida da requisição

```
criar ──> ABERTA ──(3 cotações, COMPRADOR envia)──> AGUARDANDO_APROVACAO
                                                        │
              ┌──────────── aprovar (parcial) ──────────┤  (alçada > R$ 5.000 precisa de 2 gestores)
              │                                         ├── aprovar (completou) ──> APROVADA ──(COMPRADOR)──> ORDENADA
              └─────────────────────────────────────────┤
                                                        ├── rejeitar ──> REJEITADA
                                                        └── solicitarAjuste ──> EM_AJUSTE ──(enviar de novo)──> AGUARDANDO_APROVACAO
cancelar: de ABERTA, EM_AJUSTE, AGUARDANDO_APROVACAO ou APROVADA ──> CANCELADA
Estados finais: ORDENADA, REJEITADA, CANCELADA
```

**Rollback / cancelamento parcial:** ao cancelar ou pedir ajuste, as aprovações da rodada viram `ativa = 0`
(não são apagadas). Numa nova rodada os gestores aprovam de novo.

---

## 3. Alterações que o professor pode pedir ao vivo

> Depois de alterar o backend, o `start:dev` recompila sozinho. Mudanças no `schema.sql` só valem
> para um banco novo: rode `npm run db:reset` e suba o servidor de novo (ou faça o `UPDATE` direto).

### a) "Agora são 2 cotações em vez de 3"
- `server/src/module/procurement/domain/entity/requisicao.ts` linha 8: `LIMITE_COTACOES = 2`
- `web/src/lib/api.ts`: `LIMITE_COTACOES = 2` (só o texto da tela)

### b) "A alçada de 2 aprovações passa a valer acima de R$ 10.000"
- No banco: `UPDATE alcadas SET valor_minimo = 10000.01 WHERE id = 3;`
- Ou no fim do `server/database/schema.sql` troque `5000.01` por `10000.01` e rode `npm run db:reset`.

### c) "Crie uma faixa acima de R$ 50.000 com 3 aprovações"
- `INSERT INTO alcadas (valor_minimo, aprovacoes_necessarias, solicitante_pode_aprovar) VALUES (50000.01, 3, 0);`
- Nenhum código muda: a máquina lê `aprovacoesNecessarias` da alçada (`APOS_APROVACAO` em `transicoes.ts`).

### d) "Só o DIRETOR pode rejeitar"
- `transicoes.ts`, na ação `rejeitar`: `papeis: ['DIRETOR']`

### e) "O COMPRADOR também pode cancelar"
- `transicoes.ts`, na ação `cancelar`: acrescente `'COMPRADOR'` em `papeis`.

### f) "Aprovar também exige justificativa"
- `transicoes.ts`, na ação `aprovar`: `exigeJustificativa: true`

### g) "Crie uma regra nova" (ex.: não enviar para aprovação se algum prazo passar de 30 dias)
1. Em `guardas.ts`, crie a classe:
   ```ts
   export class PrazoMaximoDeEntrega implements Guarda {
     verificar({ requisicao }: ContextoTransicao): void {
       if (requisicao.cotacoes.some((c) => c.prazoDias > 30)) {
         throw new ErroRegraNegocio('Há cotação com prazo acima de 30 dias.');
       }
     }
   }
   ```
2. Em `transicoes.ts`, na ação `enviarParaAprovacao`: `guardas: [..., new PrazoMaximoDeEntrega()]`

Isso é o **OCP**: a regra nova entrou sem mexer na `MaquinaEstados`.

### h) "A ordem de compra deve usar o MENOR PRAZO, não o menor preço"
- `requisicao.ts`, função `melhorCotacao`: troque `valorUnitario` por `prazoDias` na comparação.

### i) "Crie um usuário novo" / "Mude o papel de alguém"
- `INSERT INTO usuarios (nome, papel) VALUES ('Fulano', 'GESTOR');` — aparece sozinho no seletor do topo.

### j) "Crie um estado novo" (o mais trabalhoso)
1. `requisicao.ts`: adicionar no tipo `Status`
2. `schema.sql`: adicionar no `CHECK (status IN (...))` e rodar `npm run db:reset`
3. `transicoes.ts`: adicionar a(s) transição(ões) que entram e saem dele
4. `web/src/app/globals.css`: uma cor `.tag-NOVO_STATUS`

---

## 4. Perguntas prováveis

**Onde fica a máquina de estados?** `domain/maquina-estados/`. A matriz está em `transicoes.ts`
(estado × ação × papel × guardas). `maquina-estados.ts` só valida e responde o próximo status; ela não grava nada.

**Como impede mudar o status "na mão"?** Não existe rota nem método que receba um status. O `UPDATE` de
status só é chamado em `FluxoAprovacaoService.executar()`, depois da máquina aprovar. E o `CHECK` do banco
recusa qualquer valor fora dos 7 estados.

**Onde está a transação ACID?** `Banco.transacao()` (`BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`).
Se o `INSERT` do histórico falhar, o `UPDATE` do status é desfeito junto.

**E se dois gestores aprovarem ao mesmo tempo?** `BEGIN IMMEDIATE` pega o lock de escrita do SQLite:
a segunda transação espera a primeira terminar. Além disso, o `UPDATE ... WHERE status = ?` só altera se
o status ainda for o lido (lock otimista; se não for → 409), e o índice único parcial
`ux_aprovacao_ativa` impede o mesmo gestor aprovar duas vezes.

**Como garante 2 gestores diferentes?** Duas camadas: a guarda `AprovadorAindaNaoAprovou` (mensagem amigável)
e o índice `UNIQUE (requisicao_id, aprovador_id) WHERE ativa = 1` no banco (última defesa).

**Onde está o teto do solicitante?** Guarda `TetoDoSolicitante` + coluna `alcadas.solicitante_pode_aprovar`.

**Por que o histórico não pode ser alterado?** Triggers `historico_sem_update` e `historico_sem_delete` no
`schema.sql` dão `RAISE(ABORT)`. Teste: `UPDATE historico_status SET novo_estado = 'X';` → erro.

**Onde é a validação do backend?** `validarDadosRequisicao` e `validarCotacao` em `requisicao.ts`, usando os
value objects (`Dinheiro`, `Quantidade`, `Prioridade`, `Texto`). O front também valida (`required`, `min`),
mas o backend não confia nele. E ainda há os `CHECK` do banco.

**O que é LSP aqui?** Todas as guardas implementam `Guarda`. A máquina chama `guarda.verificar(ctx)` sem saber
qual guarda é; trocar uma pela outra não quebra a máquina.

**Por que o front sabe quais botões mostrar?** O backend devolve `acoesDisponiveis`, calculado pela própria
máquina (`acoesDisponiveis()` testa cada transição para o usuário atual). O front não repete regra.

**Por que SQLite?** É relacional de verdade (FK, CHECK, UNIQUE, triggers, transações ACID) e vem dentro do
Node 22+ (`node:sqlite`): não precisa instalar servidor de banco nem Docker para rodar no laboratório.
