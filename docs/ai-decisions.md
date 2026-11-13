# Decisões de Modelagem com IA

> Ferramenta: Claude (Anthropic), usada dentro do editor com acesso ao repositório.
> Cada decisão segue o formato pedido no enunciado: **Desafio → Prompt → Resposta bruta da IA → Crítica → Refatoração → Verificação**.
> O registro cronológico da sessão está em [`../AI-LOG.md`](../AI-LOG.md).

## Resumo

| # | Desafio | Problema na resposta da IA | Gravidade | Onde ficou a correção |
| - | ------- | -------------------------- | --------- | --------------------- |
| 1 | Alçadas multinível sem hardcode | faixas com mínimo e máximo deixavam buracos (5.000 exato ficava ambíguo) | regra inconsistente | `schema.sql` (tabela `alcadas`) |
| 2 | Máquina de estados | padrão State com 7 classes espalhava a regra | manutenção / OCP | `maquina-estados/transicoes.ts` |
| 3 | Ajuste e cancelamento no meio do fluxo | `DELETE` das aprovações apagava a trilha | violava auditoria | `aprovacoes.ativa` + índice parcial |
| 4 | Erros de constraint → HTTP | violação de UNIQUE retornava 500 | **bug real** | `erro-http.filter.ts` |
| 5 | Transação ACID | `await` dentro da transação misturaria requisições | concorrência | `banco.ts` síncrono + lock otimista |
| 6 | Listagem | uma consulta por requisição | N+1 queries | `listar()` com JOIN + GROUP BY |

---

## 1. Alçadas de aprovação configuráveis

**Desafio.** Valor < R$ 1.000 → 1 aprovação; > R$ 5.000 → 2 gestores diferentes; quem solicita não pode aprovar
acima de um teto. Tudo sem fixar ids de usuários no código.

**Prompt.**
> Como modelar um fluxo de aprovação multinível configurável sem hardcodar IDs de usuários nas regras?
> Regras: abaixo de R$ 1.000 uma aprovação, acima de R$ 5.000 dois níveis de gestores diferentes, e o
> solicitante não pode aprovar valores acima de um teto.

**Resposta bruta da IA.**
```sql
CREATE TABLE alcadas (
  id INTEGER PRIMARY KEY,
  valor_minimo REAL NOT NULL,
  valor_maximo REAL,              -- NULL = sem limite
  aprovacoes_necessarias INTEGER NOT NULL,
  papel_exigido TEXT NOT NULL     -- ex.: 'DIRETOR' na faixa 1.000–5.000
);
-- busca: WHERE ? >= valor_minimo AND (valor_maximo IS NULL OR ? < valor_maximo)
-- alternativa sugerida: tabela alcada_niveis (alcada_id, ordem, papel) para cada nível
```

**Crítica.**
- Com mínimo **e** máximo é possível cadastrar faixas que se sobrepõem ou deixam buracos, e o banco não impede.
  O enunciado diz "< 1.000" e "> 5.000"; com `<` no máximo, R$ 5.000,00 exato cairia na faixa errada.
- `papel_exigido` e `alcada_niveis` criam uma regra que o enunciado não pede (papel diferente por nível) e não resolvem
  o que ele pede: **pessoas diferentes** e o **teto do solicitante**.

**Refatoração.**
```sql
CREATE TABLE alcadas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  valor_minimo REAL NOT NULL UNIQUE CHECK (valor_minimo >= 0),
  aprovacoes_necessarias INTEGER NOT NULL CHECK (aprovacoes_necessarias >= 1),
  solicitante_pode_aprovar INTEGER NOT NULL DEFAULT 0 CHECK (solicitante_pode_aprovar IN (0, 1))
);
-- sempre existe exatamente 1 faixa:
SELECT * FROM alcadas WHERE valor_minimo <= ? ORDER BY valor_minimo DESC LIMIT 1;
```
- Só o limite inferior: não há sobreposição possível (`UNIQUE`) nem buraco (a faixa 0 sempre existe).
- `solicitante_pode_aprovar` implementa o teto (guarda `TetoDoSolicitante`).
- "Gestores diferentes" virou guarda `AprovadorAindaNaoAprovou` **e** índice `UNIQUE (requisicao_id, aprovador_id) WHERE ativa = 1`.

**Verificação.** Testes: gestora solicitante aprova a própria de R$ 500 → 201; a própria de R$ 2.000 → 403;
R$ 10.500 fica `AGUARDANDO_APROVACAO` após 1 aprovação e vai para `APROVADA` com o segundo gestor; o mesmo gestor
aprovando de novo → 422.

---

## 2. Máquina de estados respeitando OCP, SRP e LSP

**Desafio.** O status só pode mudar por ações (`aprovar()`, `rejeitar()`, `solicitarAjuste()`...), com RBAC por estado e guardas.

**Prompt.**
> Como implementar a máquina de estados da requisição de compra com transições por ação, permissão por papel e
> guardas de transição, seguindo OCP, SRP e LSP, de um jeito simples de explicar e alterar?

**Resposta bruta da IA.**
```ts
abstract class EstadoRequisicao {
  aprovar(ctx: Contexto): EstadoRequisicao { throw new Error('Ação inválida neste estado'); }
  rejeitar(ctx: Contexto): EstadoRequisicao { throw new Error('Ação inválida neste estado'); }
  // ... um método por ação
}
class AguardandoAprovacao extends EstadoRequisicao {
  aprovar(ctx) { if (ctx.usuario.papel !== 'GESTOR') throw ...; return new Aprovada(); }
  rejeitar(ctx) { ... return new Rejeitada(); }
}
class Aberta extends EstadoRequisicao { ... }   // + 5 outras classes
```

**Crítica.**
- A permissão (`papel !== 'GESTOR'`) ficou **dentro** de cada classe de estado: RBAC repetido e espalhado em 7 arquivos.
- Para responder "quem pode fazer o quê em qual estado" é preciso abrir todas as classes.
- Toda ação nova obriga a mexer na classe base **e** em várias subclasses: não é tão "fechado para modificação" quanto parece.
- `throw new Error` genérico não diferencia 403 (papel) de 409 (estado).

**Refatoração.** Matriz declarativa + guardas polimórficas:
```ts
// transicoes.ts — uma linha por ação
{ acao: 'aprovar', de: ['AGUARDANDO_APROVACAO'], para: APOS_APROVACAO,
  papeis: ['GESTOR', 'DIRETOR'],
  guardas: [new ExigeAlcadaConfigurada(), new TetoDoSolicitante(), new AprovadorAindaNaoAprovou()],
  exigeJustificativa: false }

// guardas.ts — uma classe por regra (SRP), todas substituíveis (LSP)
export interface Guarda { verificar(contexto: ContextoTransicao): void; }
```
- **OCP:** regra nova = nova classe na lista; `MaquinaEstados` nunca muda.
- **SRP:** máquina decide, repositório grava, service orquestra.
- Erros tipados: estado inválido → `ErroConflito` (409), papel → `ErroPermissao` (403), regra → `ErroRegraNegocio` (422).
- Aprovação parcial exigiu destino calculado (`APOS_APROVACAO`), que a proposta original não tratava.

**Verificação.** Testes de 409 (aprovar antes de enviar), 403 (comprador aprovando) e 422 (sem 3 cotações).

---

## 3. Cancelamento e pedido de ajuste no meio do fluxo

**Desafio.** O que acontece com as aprovações já dadas se a requisição volta para ajuste ou é cancelada.

**Prompt.**
> Quando o gestor pede ajuste ou a requisição é cancelada depois de já ter aprovações, como reiniciar a rodada
> de aprovação?

**Resposta bruta da IA.**
```ts
solicitarAjuste(id) {
  db.run('DELETE FROM aprovacoes WHERE requisicao_id = ?', [id]);
  db.run("UPDATE requisicoes SET status = 'EM_AJUSTE' WHERE id = ?", [id]);
}
```

**Crítica.**
- Apaga quem aprovou: contraria "nenhuma alteração de estado crítica pode sobrescrever dados sem histórico".
- Os dois comandos não estão em transação: se o `UPDATE` falhar, as aprovações já foram perdidas.
- O status é alterado sem passar pela máquina de estados e sem registro em `historico_status`.

**Refatoração.**
```sql
ALTER ... aprovacoes ADD ativa INTEGER NOT NULL DEFAULT 1;   -- (no schema.sql já nasce assim)
CREATE UNIQUE INDEX ux_aprovacao_ativa ON aprovacoes (requisicao_id, aprovador_id) WHERE ativa = 1;
UPDATE aprovacoes SET ativa = 0 WHERE requisicao_id = ? AND ativa = 1;
```
- Nada é apagado; a rodada antiga fica marcada como inativa.
- O índice precisou ser **parcial**: com `UNIQUE` comum, o mesmo gestor não conseguiria aprovar na rodada nova.
- Tudo roda em `FluxoAprovacaoService.executar()`, na mesma transação do `UPDATE` de status e do `INSERT` no histórico.
- Triggers impedem `UPDATE`/`DELETE` em `historico_status`.

**Verificação.** Após ajuste: 0 aprovações ativas, linhas antigas com `ativa = 0`; mesmo gestor aprova de novo na nova rodada.

---

## 4. Bug real: violação de UNIQUE virava erro 500

**Desafio.** Traduzir erros de constraint do SQLite para o código HTTP certo com mensagem amigável.

**Prompt.**
> Crie um filtro de exceções do NestJS que converta os erros de domínio e os erros de constraint do SQLite em
> códigos HTTP adequados com mensagens em português.

**Resposta bruta da IA.**
```ts
private statusDoErro(erro: unknown): number {
  ...
  const mensagem = this.mensagem(erro);          // <- já traduzida
  if (mensagem.includes('UNIQUE constraint failed')) return 409;
  ...
  return 500;
}
private mensagem(erro) {
  if (texto.includes('UNIQUE constraint failed: cotacoes'))
    return 'Este fornecedor já possui cotação nesta requisição.';
  ...
}
```

**Crítica.** O código parecia correto, mas o teste automatizado mostrou **500** ao cadastrar o mesmo fornecedor
duas vezes. `mensagem()` trocava o texto antes de `statusDoErro()` procurar `UNIQUE constraint failed`, então a
condição nunca era verdadeira. É o tipo de erro que só aparece executando: a IA não testou o próprio código.

**Refatoração.**
```ts
const mensagem = erro instanceof Error ? erro.message : '';   // mensagem ORIGINAL do banco
if (mensagem.includes('UNIQUE constraint failed')) return 409;
```

**Verificação.** Mesmo teste repetido: 409 com "Este fornecedor já possui cotação nesta requisição."

---

## 5. Transação ACID e concorrência

**Desafio.** Status e histórico precisam ser gravados juntos; dois gestores podem aprovar ao mesmo tempo.

**Prompt.**
> Como garantir que a mudança de status e o registro no histórico sejam atômicos, e o que acontece se dois
> gestores aprovarem a mesma requisição ao mesmo tempo?

**Resposta bruta da IA.**
```ts
async transacao(fn: () => Promise<void>) {
  await db.exec('BEGIN');
  try { await fn(); await db.exec('COMMIT'); }
  catch (e) { await db.exec('ROLLBACK'); throw e; }
}
```

**Crítica.**
- Com uma única conexão, cada `await` libera o event loop: outra requisição HTTP pode executar SQL **dentro** da
  transação aberta por esta, e o `ROLLBACK` desfaria o trabalho da outra também.
- `BEGIN` simples (deferred) só trava na primeira escrita: duas transações podem ler o mesmo status.
- Não há proteção contra o status ter mudado entre a leitura e a escrita.

**Refatoração.**
```ts
transacao<T>(operacao: () => T): T {          // síncrono (node:sqlite é síncrono)
  this.db.exec('BEGIN IMMEDIATE');             // lock de escrita já no início
  try { const r = operacao(); this.db.exec('COMMIT'); return r; }
  catch (erro) { this.db.exec('ROLLBACK'); throw erro; }
}
```
```sql
UPDATE requisicoes SET status = ? WHERE id = ? AND status = ?;   -- lock otimista: 0 linhas → 409
```

**Verificação.** Emitir a OC duas vezes → 409; o histórico de cada requisição tem exatamente uma linha por ação.

---

## 6. Listagem sem N+1

**Desafio.** A lista mostra número de cotações e valor estimado de cada requisição.

**Prompt.**
> Como montar a listagem de requisições com quantidade de cotações e valor estimado?

**Resposta bruta da IA.**
```ts
listar() {
  const ids = db.all('SELECT id FROM requisicoes');
  return ids.map(({ id }) => this.buscarPorId(id));   // 4 queries por requisição
}
```

**Crítica.** Com N requisições são 1 + 4N consultas, e a lista nem usa aprovações ou ordem de compra.

**Refatoração.**
```sql
SELECT r.id, r.titulo, r.status, u.nome AS solicitante,
       COUNT(c.id) AS totalCotacoes,
       MIN(c.valor_unitario) * r.quantidade AS valorEstimado
  FROM requisicoes r
  JOIN usuarios u      ON u.id = r.solicitante_id
  LEFT JOIN cotacoes c ON c.requisicao_id = r.id
 GROUP BY r.id
 ORDER BY r.id DESC;
```
`LEFT JOIN` mantém requisições sem cotação (contagem 0).

**Verificação.** Abrir a lista mostra **uma** linha `[SQL]` no terminal, qualquer que seja o número de requisições.

---

## Lições

1. A IA tende a propor o padrão "de livro" (State com uma classe por estado) mesmo quando uma tabela declarativa
   é mais simples e atende melhor o OCP.
2. Ela não considerou a trilha de auditoria ao "resetar" dados: precisei cruzar com o requisito de histórico.
3. Código plausível pode estar errado (item 4): **só o teste automatizado revelou o bug**.
4. Concorrência foi tratada de forma superficial; a correção exigiu entender como o SQLite trava e como o
   event loop do Node intercala requisições.
