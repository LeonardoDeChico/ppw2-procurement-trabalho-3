import { ErroPermissao, ErroRegraNegocio } from '../../../../shared/domain/erros';
import { LIMITE_COTACOES, valorTotal } from '../entity/requisicao';
import { ContextoTransicao } from './contexto';

/**
 * Guarda de transicao: uma condicao obrigatoria para a acao acontecer.
 * Se a condicao falhar, a guarda lanca um erro e a transicao e bloqueada.
 *
 * SOLID:
 * - SRP: cada classe verifica UMA regra.
 * - OCP: regra nova = classe nova, sem mexer na MaquinaEstados.
 * - LSP: a maquina trata qualquer Guarda do mesmo jeito (todas sao substituiveis).
 */
export interface Guarda {
  verificar(contexto: ContextoTransicao): void;
}

/** So envia para aprovacao com as 3 cotacoes registradas. */
export class ExigeCotacoesCompletas implements Guarda {
  verificar({ requisicao }: ContextoTransicao): void {
    if (requisicao.cotacoes.length < LIMITE_COTACOES) {
      throw new ErroRegraNegocio(
        `São necessárias ${LIMITE_COTACOES} cotações para enviar à aprovação (há ${requisicao.cotacoes.length}).`,
      );
    }
  }
}

/** Nao deixa registrar mais cotacoes do que o limite. */
export class LimiteDeCotacoes implements Guarda {
  verificar({ requisicao }: ContextoTransicao): void {
    if (requisicao.cotacoes.length >= LIMITE_COTACOES) {
      throw new ErroRegraNegocio(`Esta requisição já possui as ${LIMITE_COTACOES} cotações exigidas.`);
    }
  }
}

/** Precisa existir uma alcada configurada para o valor da compra. */
export class ExigeAlcadaConfigurada implements Guarda {
  verificar({ alcada }: ContextoTransicao): void {
    if (!alcada) {
      throw new ErroRegraNegocio('Nenhuma alçada de aprovação configurada para este valor.');
    }
  }
}

/** Apenas quem abriu a requisicao pode alterar os dados dela. */
export class SomenteSolicitante implements Guarda {
  verificar({ requisicao, usuario }: ContextoTransicao): void {
    if (requisicao.solicitante.id !== usuario.id) {
      throw new ErroPermissao('Somente o solicitante pode alterar esta requisição.');
    }
  }
}

/** Um SOLICITANTE so cancela a propria requisicao (gestor/diretor cancelam qualquer uma). */
export class CancelamentoPeloDonoOuGestor implements Guarda {
  verificar({ requisicao, usuario }: ContextoTransicao): void {
    if (usuario.papel === 'SOLICITANTE' && requisicao.solicitante.id !== usuario.id) {
      throw new ErroPermissao('Um solicitante só pode cancelar as próprias requisições.');
    }
  }
}

/** Alcada de 2 niveis: os aprovadores precisam ser pessoas DIFERENTES. */
export class AprovadorAindaNaoAprovou implements Guarda {
  verificar({ requisicao, usuario }: ContextoTransicao): void {
    if (requisicao.aprovacoes.some((a) => a.aprovador.id === usuario.id)) {
      throw new ErroRegraNegocio('Você já aprovou esta requisição. A alçada exige outro aprovador.');
    }
  }
}

/** Teto: acima da 1a faixa, quem solicitou nao pode aprovar a propria compra. */
export class TetoDoSolicitante implements Guarda {
  verificar({ requisicao, usuario, alcada }: ContextoTransicao): void {
    const ehOSolicitante = requisicao.solicitante.id === usuario.id;

    if (ehOSolicitante && alcada && !alcada.solicitantePodeAprovar) {
      throw new ErroPermissao(
        `Quem solicitou não pode aprovar compras a partir de R$ ${alcada.valorMinimo.toFixed(2)} ` +
          `(valor desta: R$ ${valorTotal(requisicao).toFixed(2)}).`,
      );
    }
  }
}
