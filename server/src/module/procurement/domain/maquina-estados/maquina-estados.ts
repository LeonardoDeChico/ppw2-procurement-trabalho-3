import { ErroConflito, ErroPermissao, ErroValidacao } from '../../../../shared/domain/erros';
import { Status } from '../entity/requisicao';
import { ContextoTransicao } from './contexto';
import { Acao, TRANSICOES, Transicao } from './transicoes';

export type AcaoDisponivel = { acao: Acao; exigeJustificativa: boolean };

/**
 * Maquina de estados finita da Requisicao.
 * Ela NAO grava nada: so responde "pode?" e "para qual status vai?".
 * Quem grava no banco e o service (SRP).
 *
 * Ordem das verificacoes:
 *   1. a acao existe?                         -> 409
 *   2. o status atual permite a acao?         -> 409
 *   3. o papel do usuario pode (RBAC)?        -> 403
 *   4. justificativa obrigatoria preenchida?  -> 400
 *   5. todas as guardas passaram?             -> 403 / 422
 */
export class MaquinaEstados {
  constructor(private readonly transicoes: Transicao[] = TRANSICOES) {}

  transicionar(acao: Acao, contexto: ContextoTransicao): Status {
    const transicao = this.buscar(acao);
    this.validar(transicao, contexto, true);

    return typeof transicao.para === 'function' ? transicao.para(contexto) : transicao.para;
  }

  /** Lista o que o usuario pode fazer agora (o front usa para mostrar os botoes). */
  acoesDisponiveis(contexto: ContextoTransicao): AcaoDisponivel[] {
    return this.transicoes
      .filter((transicao) => {
        try {
          this.validar(transicao, contexto, false);
          return true;
        } catch {
          return false;
        }
      })
      .map((t) => ({ acao: t.acao, exigeJustificativa: t.exigeJustificativa }));
  }

  private buscar(acao: Acao): Transicao {
    const transicao = this.transicoes.find((t) => t.acao === acao);

    if (!transicao) {
      throw new ErroConflito(`Ação desconhecida: ${acao}.`);
    }

    return transicao;
  }

  private validar(transicao: Transicao, contexto: ContextoTransicao, checarJustificativa: boolean): void {
    const { requisicao, usuario } = contexto;

    if (!transicao.de.includes(requisicao.status)) {
      throw new ErroConflito(
        `A ação "${transicao.acao}" não é permitida quando a requisição está ${requisicao.status}.`,
      );
    }

    if (!transicao.papeis.includes(usuario.papel)) {
      throw new ErroPermissao(`O papel ${usuario.papel} não pode executar a ação "${transicao.acao}".`);
    }

    if (checarJustificativa && transicao.exigeJustificativa && !contexto.justificativa) {
      throw new ErroValidacao(`A ação "${transicao.acao}" exige uma justificativa.`);
    }

    for (const guarda of transicao.guardas) {
      guarda.verificar(contexto);
    }
  }
}
