import {
  Alcada,
  DadosCotacao,
  DadosRequisicao,
  Requisicao,
  Status,
  Usuario,
} from '../entity/requisicao';
import { Acao } from '../maquina-estados/transicoes';

export const REQUISICAO_REPOSITORY = 'REQUISICAO_REPOSITORY';

export type RequisicaoResumo = {
  id: number;
  titulo: string;
  item: string;
  quantidade: number;
  prioridade: string;
  status: Status;
  solicitante: string;
  totalCotacoes: number;
  valorEstimado: number | null;
  criadaEm: string;
};

export type RegistroHistorico = {
  id: number;
  estadoAnterior: Status | null;
  novoEstado: Status;
  acao: string;
  autor: string;
  justificativa: string | null;
  criadoEm: string;
};

/**
 * Porta (interface) do repositorio. O dominio e os services so conhecem
 * esta interface; a implementacao com SQL fica na infraestrutura (DIP).
 */
export interface RequisicaoRepository {
  transacao<T>(operacao: () => T): T;

  listar(): RequisicaoResumo[];
  buscarPorId(id: number): Requisicao | null;
  criar(dados: DadosRequisicao, solicitanteId: number): number;
  atualizarDados(id: number, dados: DadosRequisicao): void;
  atualizarStatus(id: number, statusAtual: Status, novoStatus: Status): void;

  inserirCotacao(requisicaoId: number, dados: DadosCotacao): void;
  removerCotacao(requisicaoId: number, cotacaoId: number): void;

  inserirAprovacao(requisicaoId: number, aprovadorId: number, justificativa: string | null): void;
  invalidarAprovacoes(requisicaoId: number): void;

  inserirOrdemCompra(requisicaoId: number, cotacaoId: number, numero: string, valorTotal: number): void;

  registrarHistorico(dados: {
    requisicaoId: number;
    estadoAnterior: Status | null;
    novoEstado: Status;
    acao: Acao | 'criar';
    autorId: number;
    justificativa: string | null;
  }): void;
  listarHistorico(requisicaoId: number): RegistroHistorico[];

  buscarUsuario(id: number): Usuario | null;
  listarUsuarios(): Usuario[];
  buscarAlcada(valor: number): Alcada | null;
  listarAlcadas(): Alcada[];
}
