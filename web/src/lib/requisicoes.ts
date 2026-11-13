import { API_URL, Acao, Alcada, DadosRequisicao, Requisicao, RequisicaoResumo, Usuario, usuarioAtualId } from "./api";

/** Faz a chamada HTTP enviando quem e o usuario atual (cabecalho x-usuario-id). */
async function chamar<T>(rota: string, metodo = "GET", corpo?: unknown): Promise<T> {
  const resposta = await fetch(`${API_URL}/procurement${rota}`, {
    method: metodo,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "x-usuario-id": String(usuarioAtualId()),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    // o backend sempre devolve { statusCode, message }
    const mensagem = (dados as { message?: string | string[] }).message;
    throw new Error(`${resposta.status} - ${Array.isArray(mensagem) ? mensagem.join(", ") : mensagem ?? "Erro"}`);
  }

  return dados as T;
}

export const listarUsuarios = () => chamar<Usuario[]>("/usuarios");
export const listarAlcadas = () => chamar<Alcada[]>("/alcadas");
export const listarRequisicoes = () => chamar<RequisicaoResumo[]>("/requisicoes");
export const buscarRequisicao = (id: number) => chamar<Requisicao>(`/requisicoes/${id}`);

export const criarRequisicao = (dados: DadosRequisicao) => chamar<Requisicao>("/requisicoes", "POST", dados);

export const atualizarRequisicao = (id: number, dados: DadosRequisicao) =>
  chamar<Requisicao>(`/requisicoes/${id}`, "PUT", dados);

export const registrarCotacao = (
  id: number,
  dados: { fornecedor: string; valorUnitario: number; prazoDias: number; observacao?: string },
) => chamar<Requisicao>(`/requisicoes/${id}/cotacoes`, "POST", dados);

export const removerCotacao = (id: number, cotacaoId: number) =>
  chamar<Requisicao>(`/requisicoes/${id}/cotacoes/${cotacaoId}`, "DELETE");

/** Rota de cada acao da maquina de estados (o status so muda por aqui). */
const ROTAS_ACAO: Partial<Record<Acao, string>> = {
  enviarParaAprovacao: "enviar",
  aprovar: "aprovar",
  rejeitar: "rejeitar",
  solicitarAjuste: "solicitar-ajuste",
  cancelar: "cancelar",
  emitirOrdemCompra: "ordem-compra",
};

export const executarAcao = (id: number, acao: Acao, justificativa?: string) =>
  chamar<Requisicao>(`/requisicoes/${id}/${ROTAS_ACAO[acao]}`, "POST", { justificativa });
