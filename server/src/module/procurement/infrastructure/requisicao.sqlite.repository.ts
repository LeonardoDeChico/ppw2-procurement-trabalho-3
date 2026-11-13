import { Injectable } from '@nestjs/common';
import { Banco } from '../../../shared/infrastructure/database/banco';
import { ErroConflito } from '../../../shared/domain/erros';
import {
  Alcada,
  DadosCotacao,
  DadosRequisicao,
  Papel,
  Requisicao,
  Status,
  Usuario,
} from '../domain/entity/requisicao';
import {
  RegistroHistorico,
  RequisicaoRepository,
  RequisicaoResumo,
} from '../domain/ports/requisicao.repository';
import { Acao } from '../domain/maquina-estados/transicoes';

/** Implementacao do repositorio com SQL puro no SQLite. */
@Injectable()
export class RequisicaoSqliteRepository implements RequisicaoRepository {
  constructor(private readonly banco: Banco) {}

  transacao<T>(operacao: () => T): T {
    return this.banco.transacao(operacao);
  }

  // ------------------------------------------------------------------ leitura

  /** Uma unica query (JOIN + GROUP BY) para a lista inteira: sem N+1. */
  listar(): RequisicaoResumo[] {
    return this.banco.buscarTodos<RequisicaoResumo>(
      `SELECT r.id, r.titulo, r.item, r.quantidade, r.prioridade, r.status,
              u.nome                         AS solicitante,
              COUNT(c.id)                    AS totalCotacoes,
              MIN(c.valor_unitario) * r.quantidade AS valorEstimado,
              r.criada_em                    AS criadaEm
         FROM requisicoes r
         JOIN usuarios u      ON u.id = r.solicitante_id
         LEFT JOIN cotacoes c ON c.requisicao_id = r.id
        GROUP BY r.id
        ORDER BY r.id DESC`,
    );
  }

  buscarPorId(id: number): Requisicao | null {
    const linha = this.banco.buscarUm<any>(
      `SELECT r.*, u.nome AS solicitante_nome, u.papel AS solicitante_papel
         FROM requisicoes r
         JOIN usuarios u ON u.id = r.solicitante_id
        WHERE r.id = ?`,
      [id],
    );

    if (!linha) return null;

    const cotacoes = this.banco.buscarTodos<any>(
      `SELECT id, fornecedor, valor_unitario, prazo_dias, observacao, registrada_em
         FROM cotacoes
        WHERE requisicao_id = ?
        ORDER BY id`,
      [id],
    );

    const aprovacoes = this.banco.buscarTodos<any>(
      `SELECT a.id, a.justificativa, a.aprovada_em, u.id AS aprovador_id, u.nome, u.papel
         FROM aprovacoes a
         JOIN usuarios u ON u.id = a.aprovador_id
        WHERE a.requisicao_id = ? AND a.ativa = 1
        ORDER BY a.id`,
      [id],
    );

    const ordem = this.banco.buscarUm<any>(
      `SELECT id, numero, cotacao_id, valor_total, emitida_em
         FROM ordens_compra
        WHERE requisicao_id = ?`,
      [id],
    );

    return {
      id: linha.id,
      titulo: linha.titulo,
      item: linha.item,
      quantidade: linha.quantidade,
      centroCusto: linha.centro_custo,
      prioridade: linha.prioridade,
      justificativa: linha.justificativa,
      status: linha.status,
      solicitante: { id: linha.solicitante_id, nome: linha.solicitante_nome, papel: linha.solicitante_papel },
      cotacoes: cotacoes.map((c) => ({
        id: c.id,
        fornecedor: c.fornecedor,
        valorUnitario: c.valor_unitario,
        prazoDias: c.prazo_dias,
        observacao: c.observacao,
        registradaEm: c.registrada_em,
      })),
      aprovacoes: aprovacoes.map((a) => ({
        id: a.id,
        aprovador: { id: a.aprovador_id, nome: a.nome, papel: a.papel },
        justificativa: a.justificativa,
        aprovadaEm: a.aprovada_em,
      })),
      ordemCompra: ordem
        ? {
            id: ordem.id,
            numero: ordem.numero,
            cotacaoId: ordem.cotacao_id,
            valorTotal: ordem.valor_total,
            emitidaEm: ordem.emitida_em,
          }
        : null,
      criadaEm: linha.criada_em,
      atualizadaEm: linha.atualizada_em,
    };
  }

  // ------------------------------------------------------------------ escrita

  criar(dados: DadosRequisicao, solicitanteId: number): number {
    const { id } = this.banco.executar(
      `INSERT INTO requisicoes (titulo, item, quantidade, centro_custo, prioridade, justificativa, solicitante_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [dados.titulo, dados.item, dados.quantidade, dados.centroCusto, dados.prioridade, dados.justificativa, solicitanteId],
    );

    return id;
  }

  atualizarDados(id: number, dados: DadosRequisicao): void {
    this.banco.executar(
      `UPDATE requisicoes
          SET titulo = ?, item = ?, quantidade = ?, centro_custo = ?, prioridade = ?, justificativa = ?,
              atualizada_em = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ?`,
      [dados.titulo, dados.item, dados.quantidade, dados.centroCusto, dados.prioridade, dados.justificativa, id],
    );
  }

  /**
   * Controle de concorrencia (lock otimista): so atualiza se o status no banco
   * ainda for o que foi lido. Se outro usuario mudou antes, 0 linhas sao
   * afetadas e a transacao inteira e desfeita.
   */
  atualizarStatus(id: number, statusAtual: Status, novoStatus: Status): void {
    const { linhasAfetadas } = this.banco.executar(
      `UPDATE requisicoes
          SET status = ?, atualizada_em = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
        WHERE id = ? AND status = ?`,
      [novoStatus, id, statusAtual],
    );

    if (linhasAfetadas === 0) {
      throw new ErroConflito('A requisição foi alterada por outro usuário. Recarregue a página.');
    }
  }

  inserirCotacao(requisicaoId: number, dados: DadosCotacao): void {
    this.banco.executar(
      `INSERT INTO cotacoes (requisicao_id, fornecedor, valor_unitario, prazo_dias, observacao)
       VALUES (?, ?, ?, ?, ?)`,
      [requisicaoId, dados.fornecedor, dados.valorUnitario, dados.prazoDias, dados.observacao],
    );
  }

  removerCotacao(requisicaoId: number, cotacaoId: number): void {
    this.banco.executar(`DELETE FROM cotacoes WHERE id = ? AND requisicao_id = ?`, [cotacaoId, requisicaoId]);
  }

  inserirAprovacao(requisicaoId: number, aprovadorId: number, justificativa: string | null): void {
    this.banco.executar(
      `INSERT INTO aprovacoes (requisicao_id, aprovador_id, justificativa) VALUES (?, ?, ?)`,
      [requisicaoId, aprovadorId, justificativa],
    );
  }

  /** Nao apaga: so marca a rodada de aprovacoes como inativa (fica no historico). */
  invalidarAprovacoes(requisicaoId: number): void {
    this.banco.executar(`UPDATE aprovacoes SET ativa = 0 WHERE requisicao_id = ? AND ativa = 1`, [requisicaoId]);
  }

  inserirOrdemCompra(requisicaoId: number, cotacaoId: number, numero: string, valorTotal: number): void {
    this.banco.executar(
      `INSERT INTO ordens_compra (numero, requisicao_id, cotacao_id, valor_total) VALUES (?, ?, ?, ?)`,
      [numero, requisicaoId, cotacaoId, valorTotal],
    );
  }

  // ------------------------------------------------------------------ auditoria

  registrarHistorico(dados: {
    requisicaoId: number;
    estadoAnterior: Status | null;
    novoEstado: Status;
    acao: Acao | 'criar';
    autorId: number;
    justificativa: string | null;
  }): void {
    this.banco.executar(
      `INSERT INTO historico_status (requisicao_id, estado_anterior, novo_estado, acao, autor_id, justificativa)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [dados.requisicaoId, dados.estadoAnterior, dados.novoEstado, dados.acao, dados.autorId, dados.justificativa],
    );
  }

  listarHistorico(requisicaoId: number): RegistroHistorico[] {
    return this.banco.buscarTodos<RegistroHistorico>(
      `SELECT h.id, h.estado_anterior AS estadoAnterior, h.novo_estado AS novoEstado, h.acao,
              u.nome AS autor, h.justificativa, h.criado_em AS criadoEm
         FROM historico_status h
         JOIN usuarios u ON u.id = h.autor_id
        WHERE h.requisicao_id = ?
        ORDER BY h.id`,
      [requisicaoId],
    );
  }

  // ------------------------------------------------------------------ cadastros

  buscarUsuario(id: number): Usuario | null {
    return this.banco.buscarUm<Usuario>(`SELECT id, nome, papel FROM usuarios WHERE id = ?`, [id]) ?? null;
  }

  listarUsuarios(): Usuario[] {
    return this.banco.buscarTodos<{ id: number; nome: string; papel: Papel }>(
      `SELECT id, nome, papel FROM usuarios ORDER BY id`,
    );
  }

  /** Faixa de maior valor_minimo que ainda seja <= valor da compra. */
  buscarAlcada(valor: number): Alcada | null {
    const linha = this.banco.buscarUm<any>(
      `SELECT * FROM alcadas WHERE valor_minimo <= ? ORDER BY valor_minimo DESC LIMIT 1`,
      [valor],
    );

    return linha ? this.paraAlcada(linha) : null;
  }

  listarAlcadas(): Alcada[] {
    return this.banco.buscarTodos<any>(`SELECT * FROM alcadas ORDER BY valor_minimo`).map((l) => this.paraAlcada(l));
  }

  private paraAlcada(linha: any): Alcada {
    return {
      id: linha.id,
      valorMinimo: linha.valor_minimo,
      aprovacoesNecessarias: linha.aprovacoes_necessarias,
      solicitantePodeAprovar: linha.solicitante_pode_aprovar === 1,
    };
  }
}
