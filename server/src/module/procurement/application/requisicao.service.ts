import { Inject, Injectable } from '@nestjs/common';
import { ErroNaoAutenticado, ErroNaoEncontrado } from '../../../shared/domain/erros';
import {
  Requisicao,
  Usuario,
  melhorCotacao,
  validarCotacao,
  validarDadosRequisicao,
  valorTotal,
} from '../domain/entity/requisicao';
import { MaquinaEstados } from '../domain/maquina-estados/maquina-estados';
import { REQUISICAO_REPOSITORY, RequisicaoRepository } from '../domain/ports/requisicao.repository';

/**
 * Casos de uso de CADASTRO e CONSULTA (nao mudam o status).
 * Mesmo assim passam pela maquina de estados para checar se o status
 * atual e o papel do usuario permitem a acao.
 */
@Injectable()
export class RequisicaoService {
  constructor(
    @Inject(REQUISICAO_REPOSITORY) private readonly repositorio: RequisicaoRepository,
    private readonly maquina: MaquinaEstados,
  ) {}

  listar() {
    return this.repositorio.listar();
  }

  listarUsuarios() {
    return this.repositorio.listarUsuarios();
  }

  listarAlcadas() {
    return this.repositorio.listarAlcadas();
  }

  /** Detalhe completo + quais acoes o usuario atual pode fazer + historico. */
  detalhar(id: number, usuarioId: number | null) {
    const requisicao = this.buscarRequisicao(id);
    const usuario = usuarioId ? this.repositorio.buscarUsuario(usuarioId) : null;
    const alcada = this.repositorio.buscarAlcada(valorTotal(requisicao));

    return {
      ...requisicao,
      melhorCotacao: melhorCotacao(requisicao),
      valorTotal: valorTotal(requisicao),
      alcada,
      acoesDisponiveis: usuario
        ? this.maquina.acoesDisponiveis({ requisicao, usuario, alcada, justificativa: null })
        : [],
      historico: this.repositorio.listarHistorico(id),
    };
  }

  criar(dados: unknown, usuarioId: number) {
    const usuario = this.buscarUsuario(usuarioId);
    const validos = validarDadosRequisicao(dados);

    const id = this.repositorio.transacao(() => {
      const novoId = this.repositorio.criar(validos, usuario.id);

      this.repositorio.registrarHistorico({
        requisicaoId: novoId,
        estadoAnterior: null,
        novoEstado: 'ABERTA',
        acao: 'criar',
        autorId: usuario.id,
        justificativa: 'Requisição aberta.',
      });

      return novoId;
    });

    return this.detalhar(id, usuario.id);
  }

  editar(id: number, dados: unknown, usuarioId: number) {
    this.repositorio.transacao(() => {
      this.autorizar(id, usuarioId, 'editar');
      this.repositorio.atualizarDados(id, validarDadosRequisicao(dados));
    });

    return this.detalhar(id, usuarioId);
  }

  registrarCotacao(id: number, dados: unknown, usuarioId: number) {
    this.repositorio.transacao(() => {
      this.autorizar(id, usuarioId, 'registrarCotacao');
      this.repositorio.inserirCotacao(id, validarCotacao(dados));
    });

    return this.detalhar(id, usuarioId);
  }

  removerCotacao(id: number, cotacaoId: number, usuarioId: number) {
    this.repositorio.transacao(() => {
      this.autorizar(id, usuarioId, 'removerCotacao');
      this.repositorio.removerCotacao(id, cotacaoId);
    });

    return this.detalhar(id, usuarioId);
  }

  // ------------------------------------------------------------------

  /** Pergunta para a maquina de estados se a acao e permitida (lanca erro se nao for). */
  private autorizar(id: number, usuarioId: number, acao: 'editar' | 'registrarCotacao' | 'removerCotacao') {
    const requisicao = this.buscarRequisicao(id);
    const usuario = this.buscarUsuario(usuarioId);
    const alcada = this.repositorio.buscarAlcada(valorTotal(requisicao));

    this.maquina.transicionar(acao, { requisicao, usuario, alcada, justificativa: null });
  }

  private buscarRequisicao(id: number): Requisicao {
    const requisicao = this.repositorio.buscarPorId(id);

    if (!requisicao) {
      throw new ErroNaoEncontrado('Requisição não encontrada.');
    }

    return requisicao;
  }

  private buscarUsuario(id: number): Usuario {
    const usuario = this.repositorio.buscarUsuario(id);

    if (!usuario) {
      throw new ErroNaoAutenticado('Usuário não encontrado.');
    }

    return usuario;
  }
}
