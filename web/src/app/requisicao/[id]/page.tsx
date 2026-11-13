"use client";

import { use, useEffect, useState } from "react";
import { Acao, LIMITE_COTACOES, Requisicao, codigo, formatarData, formatarValor } from "@/lib/api";
import { buscarRequisicao, executarAcao, registrarCotacao, removerCotacao } from "@/lib/requisicoes";

/** Texto e cor dos botoes de cada acao de fluxo. */
const BOTOES: Partial<Record<Acao, { texto: string; classe: string }>> = {
  enviarParaAprovacao: { texto: "📤 Enviar para aprovação", classe: "botao" },
  aprovar: { texto: "✔ Aprovar", classe: "botao botao-verde" },
  solicitarAjuste: { texto: "↩ Solicitar ajuste", classe: "botao botao-amarelo" },
  rejeitar: { texto: "✘ Rejeitar", classe: "botao botao-vermelho" },
  emitirOrdemCompra: { texto: "📄 Emitir Ordem de Compra", classe: "botao" },
  cancelar: { texto: "Cancelar requisição", classe: "botao botao-cinza" },
};

export default function DetalheRequisicaoPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number(use(params).id);

  const [requisicao, setRequisicao] = useState<Requisicao | null>(null);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [cotacao, setCotacao] = useState({ fornecedor: "", valorUnitario: "", prazoDias: "", observacao: "" });

  useEffect(() => {
    buscarRequisicao(id).then(setRequisicao).catch((e) => setErro(e.message));
  }, [id]);

  /** Executa uma chamada, atualiza a tela e mostra sucesso ou o erro vindo da API. */
  async function rodar(chamada: () => Promise<Requisicao>, sucesso: string) {
    setErro("");
    setMensagem("");
    try {
      setRequisicao(await chamada());
      setMensagem(sucesso);
      return true;
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro inesperado");
      return false;
    } finally {
      window.scrollTo({ top: 0, behavior: "smooth" }); // mostra a mensagem de sucesso/erro
    }
  }

  async function aoExecutar(acao: Acao) {
    const ok = await rodar(() => executarAcao(id, acao, justificativa || undefined), "Ação executada com sucesso.");
    if (ok) setJustificativa("");
  }

  async function aoCotar(e: React.FormEvent) {
    e.preventDefault();
    const ok = await rodar(
      () =>
        registrarCotacao(id, {
          fornecedor: cotacao.fornecedor,
          valorUnitario: Number(cotacao.valorUnitario),
          prazoDias: Number(cotacao.prazoDias),
          observacao: cotacao.observacao || undefined,
        }),
      "Cotação registrada.",
    );
    if (ok) setCotacao({ fornecedor: "", valorUnitario: "", prazoDias: "", observacao: "" });
  }

  if (!requisicao) return erro ? <p className="erro">{erro}</p> : <p className="vazio">Carregando...</p>;

  const pode = (acao: Acao) => requisicao.acoesDisponiveis.some((a) => a.acao === acao);
  const acoesDeFluxo = requisicao.acoesDisponiveis.filter((a) => BOTOES[a.acao]);
  const algumaExigeJustificativa = acoesDeFluxo.some((a) => a.exigeJustificativa);

  return (
    <>
      <div className="cabecalho-pagina">
        <h1>
          {codigo(requisicao.id)} — {requisicao.titulo}
        </h1>
        <div className="acoes" style={{ marginTop: 0 }}>
          {pode("editar") && (
            <a href={`/requisicao/${id}/editar`} className="botao botao-pequeno">
              Alterar
            </a>
          )}
          <a href="/" className="botao botao-cinza botao-pequeno">
            ← Voltar
          </a>
        </div>
      </div>

      {erro && <p className="erro">{erro}</p>}
      {mensagem && <p className="sucesso">{mensagem}</p>}

      <section className="secao">
        <h2>Dados da Requisição</h2>
        <p>
          <span className={`tag tag-${requisicao.status}`}>{requisicao.status}</span>{" "}
          <span className={`tag tag-${requisicao.prioridade}`}>{requisicao.prioridade}</span>
        </p>
        <p>
          <strong>Item:</strong> {requisicao.item} · <strong>Quantidade:</strong> {requisicao.quantidade}
        </p>
        <p>
          <strong>Solicitante:</strong> {requisicao.solicitante.nome} · <strong>Centro de Custo:</strong>{" "}
          {requisicao.centroCusto}
        </p>
        <p>
          <strong>Justificativa:</strong> {requisicao.justificativa || "-"}
        </p>
      </section>

      <section className="secao">
        <h2>Cotações ({requisicao.cotacoes.length}/{LIMITE_COTACOES})</h2>

        {requisicao.cotacoes.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Fornecedor</th>
                <th>Valor unitário</th>
                <th>Prazo</th>
                <th>Observação</th>
                {pode("removerCotacao") && <th></th>}
              </tr>
            </thead>
            <tbody>
              {requisicao.cotacoes.map((c) => (
                <tr key={c.id} className={c.id === requisicao.melhorCotacao?.id ? "linha-destaque" : ""}>
                  <td>{c.fornecedor}</td>
                  <td>{formatarValor(c.valorUnitario)}</td>
                  <td>{c.prazoDias} dias</td>
                  <td>{c.observacao || "-"}</td>
                  {pode("removerCotacao") && (
                    <td>
                      <button
                        className="botao botao-vermelho botao-pequeno"
                        onClick={() => rodar(() => removerCotacao(id, c.id), "Cotação removida.")}
                      >
                        Remover
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {pode("registrarCotacao") && (
          <form onSubmit={aoCotar} style={{ marginTop: 16 }}>
            <div className="grade-2">
              <div className="campo">
                <label htmlFor="fornecedor">Fornecedor</label>
                <input
                  id="fornecedor"
                  value={cotacao.fornecedor}
                  onChange={(e) => setCotacao({ ...cotacao, fornecedor: e.target.value })}
                  required
                />
              </div>
              <div className="campo">
                <label htmlFor="valor">Valor unitário (R$)</label>
                <input
                  id="valor"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={cotacao.valorUnitario}
                  onChange={(e) => setCotacao({ ...cotacao, valorUnitario: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grade-2">
              <div className="campo">
                <label htmlFor="prazo">Prazo (dias)</label>
                <input
                  id="prazo"
                  type="number"
                  min="1"
                  value={cotacao.prazoDias}
                  onChange={(e) => setCotacao({ ...cotacao, prazoDias: e.target.value })}
                  required
                />
              </div>
              <div className="campo">
                <label htmlFor="observacao">Observação</label>
                <input
                  id="observacao"
                  value={cotacao.observacao}
                  onChange={(e) => setCotacao({ ...cotacao, observacao: e.target.value })}
                />
              </div>
            </div>
            <button className="botao" type="submit">
              Adicionar cotação
            </button>
          </form>
        )}
      </section>

      <section className="secao">
        <h2>Alçada de Aprovação</h2>
        <p>
          Valor total (melhor cotação × quantidade): <strong>{formatarValor(requisicao.valorTotal)}</strong>
        </p>
        {requisicao.alcada && (
          <p>
            Faixa a partir de {formatarValor(requisicao.alcada.valorMinimo)}: exige{" "}
            <strong>{requisicao.alcada.aprovacoesNecessarias}</strong>{" "}
            {requisicao.alcada.aprovacoesNecessarias > 1 ? "aprovações de gestores diferentes" : "aprovação"} ·
            solicitante {requisicao.alcada.solicitantePodeAprovar ? "pode" : "não pode"} aprovar a própria compra.
          </p>
        )}
        <p>
          Aprovações nesta rodada: <strong>{requisicao.aprovacoes.length}</strong>
          {requisicao.alcada ? ` de ${requisicao.alcada.aprovacoesNecessarias}` : ""}
        </p>
        {requisicao.aprovacoes.map((a) => (
          <p key={a.id} className="info">
            ✔ {a.aprovador.nome} ({a.aprovador.papel}) em {formatarData(a.aprovadaEm)}
            {a.justificativa ? ` — ${a.justificativa}` : ""}
          </p>
        ))}
      </section>

      {requisicao.ordemCompra && (
        <section className="secao">
          <h2>Ordem de Compra</h2>
          <div className="destaque">
            <p>
              <strong>Nº {requisicao.ordemCompra.numero}</strong> · Fornecedor:{" "}
              <strong>{requisicao.cotacoes.find((c) => c.id === requisicao.ordemCompra?.cotacaoId)?.fornecedor}</strong>
            </p>
            <p>
              Valor total: <strong>{formatarValor(requisicao.ordemCompra.valorTotal)}</strong> · Emitida em{" "}
              {formatarData(requisicao.ordemCompra.emitidaEm)}
            </p>
          </div>
        </section>
      )}

      <section className="secao">
        <h2>Ações disponíveis para você</h2>
        {acoesDeFluxo.length === 0 ? (
          <p className="info">Nenhuma ação de fluxo disponível para o seu papel neste status.</p>
        ) : (
          <>
            {algumaExigeJustificativa && (
              <div className="campo">
                <label htmlFor="justificativa">Justificativa (obrigatória para rejeitar, ajustar e cancelar)</label>
                <input id="justificativa" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
              </div>
            )}
            <div className="acoes">
              {acoesDeFluxo.map((a) => (
                <button key={a.acao} className={BOTOES[a.acao]!.classe} onClick={() => aoExecutar(a.acao)}>
                  {BOTOES[a.acao]!.texto}
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="secao">
        <h2>Histórico de Status (auditoria)</h2>
        <table>
          <thead>
            <tr>
              <th>Quando</th>
              <th>De → Para</th>
              <th>Ação</th>
              <th>Autor</th>
              <th>Justificativa</th>
            </tr>
          </thead>
          <tbody>
            {requisicao.historico.map((h) => (
              <tr key={h.id}>
                <td>{formatarData(h.criadoEm)}</td>
                <td>
                  {h.estadoAnterior ?? "—"} → {h.novoEstado}
                </td>
                <td>{h.acao}</td>
                <td>{h.autor}</td>
                <td>{h.justificativa || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
