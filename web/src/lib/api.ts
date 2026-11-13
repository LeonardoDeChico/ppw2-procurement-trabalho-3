export type Papel = "SOLICITANTE" | "COMPRADOR" | "GESTOR" | "DIRETOR";

export type Usuario = { id: number; nome: string; papel: Papel };

export type Cotacao = {
  id: number;
  fornecedor: string;
  valorUnitario: number;
  prazoDias: number;
  observacao: string | null;
  registradaEm: string;
};

export type Aprovacao = {
  id: number;
  aprovador: Usuario;
  justificativa: string | null;
  aprovadaEm: string;
};

export type Alcada = {
  id: number;
  valorMinimo: number;
  aprovacoesNecessarias: number;
  solicitantePodeAprovar: boolean;
};

export type Historico = {
  id: number;
  estadoAnterior: string | null;
  novoEstado: string;
  acao: string;
  autor: string;
  justificativa: string | null;
  criadoEm: string;
};

export type Acao =
  | "editar"
  | "registrarCotacao"
  | "removerCotacao"
  | "enviarParaAprovacao"
  | "aprovar"
  | "rejeitar"
  | "solicitarAjuste"
  | "emitirOrdemCompra"
  | "cancelar";

export type RequisicaoResumo = {
  id: number;
  titulo: string;
  item: string;
  quantidade: number;
  prioridade: string;
  status: string;
  solicitante: string;
  totalCotacoes: number;
  valorEstimado: number | null;
  criadaEm: string;
};

export type Requisicao = {
  id: number;
  titulo: string;
  item: string;
  quantidade: number;
  centroCusto: string;
  prioridade: "BAIXA" | "MEDIA" | "ALTA";
  justificativa: string | null;
  status: string;
  solicitante: Usuario;
  cotacoes: Cotacao[];
  aprovacoes: Aprovacao[];
  ordemCompra: { id: number; numero: string; cotacaoId: number; valorTotal: number; emitidaEm: string } | null;
  criadaEm: string;
  atualizadaEm: string | null;
  melhorCotacao: Cotacao | null;
  valorTotal: number;
  alcada: Alcada | null;
  acoesDisponiveis: { acao: Acao; exigeJustificativa: boolean }[];
  historico: Historico[];
};

export type DadosRequisicao = {
  titulo: string;
  item: string;
  quantidade: number;
  centroCusto: string;
  prioridade: string;
  justificativa?: string;
};

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** So para exibir na tela. A regra de verdade esta no backend (LIMITE_COTACOES em requisicao.ts). */
export const LIMITE_COTACOES = 3;

/** Login simulado: o id do usuario escolhido no topo fica no navegador. */
export function usuarioAtualId(): number {
  if (typeof window === "undefined") return 1;
  try {
    return Number(localStorage.getItem("usuarioId") ?? "1");
  } catch {
    return 1;
  }
}

export function definirUsuarioAtual(id: number) {
  try {
    localStorage.setItem("usuarioId", String(id));
  } catch {
    /* sem localStorage: fica o padrao */
  }
}

export function codigo(id: number): string {
  return `REQ-${String(id).padStart(4, "0")}`;
}

export function formatarValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarData(data?: string | null): string {
  if (!data) return "-";
  return new Date(data).toLocaleString("pt-BR");
}
