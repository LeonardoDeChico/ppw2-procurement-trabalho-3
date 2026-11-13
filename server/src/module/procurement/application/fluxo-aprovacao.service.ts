import { Inject, Injectable } from '@nestjs/common';
import { ErroNaoAutenticado, ErroNaoEncontrado } from '../../../shared/domain/erros';
import { Texto } from '../../../shared/domain/value.objects/texto.vo';
import { Requisicao, Usuario, melhorCotacao, valorTotal } from '../domain/entity/requisicao';
import { MaquinaEstados } from '../domain/maquina-estados/maquina-estados';
import { Acao } from '../domain/maquina-estados/transicoes';
import { REQUISICAO_REPOSITORY, RequisicaoRepository } from '../domain/ports/requisicao.repository';
import { RequisicaoService } from './requisicao.service';

/** Efeito extra de uma acao (ex.: gravar a aprovacao, gerar a ordem de compra). */
type Efeito = (requisicao: Requisicao, usuario: Usuario) => void;

/**
 * Casos de uso que MUDAM O STATUS da requisicao.
 * Todos seguem o mesmo roteiro dentro de UMA transacao (metodo executar):
 *   1. le a requisicao, o usuario e a alcada
 *   2. a maquina de estados valida e devolve o novo status
 *   3. aplica o efeito da acao (se houver)
 *   4. UPDATE do status (com lock otimista)
 *   5. INSERT no historico_status (trilha de auditoria)
 * Se qualquer passo falhar -> ROLLBACK de tudo.
 */
@Injectable()
export class FluxoAprovacaoService {
  constructor(
    @Inject(REQUISICAO_REPOSITORY) private readonly repositorio: RequisicaoRepository,
    private readonly maquina: MaquinaEstados,
    private readonly requisicaoService: RequisicaoService,
  ) {}

  enviarParaAprovacao(id: number, usuarioId: number) {
    return this.executar(id, usuarioId, 'enviarParaAprovacao', null);
  }

  aprovar(id: number, usuarioId: number, justificativa: unknown) {
    return this.executar(id, usuarioId, 'aprovar', justificativa, (requisicao, usuario) => {
      this.repositorio.inserirAprovacao(requisicao.id, usuario.id, Texto.opcional(justificativa));
    });
  }

  rejeitar(id: number, usuarioId: number, justificativa: unknown) {
    return this.executar(id, usuarioId, 'rejeitar', justificativa);
  }

  /** Volta para o solicitante corrigir. As aprovacoes desta rodada deixam de valer. */
  solicitarAjuste(id: number, usuarioId: number, justificativa: unknown) {
    return this.executar(id, usuarioId, 'solicitarAjuste', justificativa, (requisicao) => {
      this.repositorio.invalidarAprovacoes(requisicao.id);
    });
  }

  /** Cancelamento no meio do fluxo: invalida aprovacoes ja dadas (nada e apagado). */
  cancelar(id: number, usuarioId: number, justificativa: unknown) {
    return this.executar(id, usuarioId, 'cancelar', justificativa, (requisicao) => {
      this.repositorio.invalidarAprovacoes(requisicao.id);
    });
  }

  /** Gera a ordem de compra com a cotacao de MENOR valor. */
  emitirOrdemCompra(id: number, usuarioId: number) {
    return this.executar(id, usuarioId, 'emitirOrdemCompra', null, (requisicao) => {
      const cotacao = melhorCotacao(requisicao)!;
      const numero = `OC-${String(requisicao.id).padStart(4, '0')}`;

      this.repositorio.inserirOrdemCompra(requisicao.id, cotacao.id, numero, valorTotal(requisicao));
    });
  }

  // ------------------------------------------------------------------

  private executar(id: number, usuarioId: number, acao: Acao, justificativaBruta: unknown, efeito?: Efeito) {
    const justificativa = Texto.opcional(justificativaBruta);

    this.repositorio.transacao(() => {
      const requisicao = this.repositorio.buscarPorId(id);
      if (!requisicao) throw new ErroNaoEncontrado('Requisição não encontrada.');

      const usuario = this.repositorio.buscarUsuario(usuarioId);
      if (!usuario) throw new ErroNaoAutenticado('Usuário não encontrado.');

      const alcada = this.repositorio.buscarAlcada(valorTotal(requisicao));

      const novoStatus = this.maquina.transicionar(acao, { requisicao, usuario, alcada, justificativa });

      efeito?.(requisicao, usuario);

      if (novoStatus !== requisicao.status) {
        this.repositorio.atualizarStatus(requisicao.id, requisicao.status, novoStatus);
      }

      this.repositorio.registrarHistorico({
        requisicaoId: requisicao.id,
        estadoAnterior: requisicao.status,
        novoEstado: novoStatus,
        acao,
        autorId: usuario.id,
        justificativa,
      });
    });

    return this.requisicaoService.detalhar(id, usuarioId);
  }
}
