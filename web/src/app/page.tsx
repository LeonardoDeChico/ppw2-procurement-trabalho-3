"use client";

import { useEffect, useState } from "react";
import { Alcada, LIMITE_COTACOES, RequisicaoResumo, codigo, formatarData, formatarValor } from "@/lib/api";
import { listarAlcadas, listarRequisicoes } from "@/lib/requisicoes";

export default function PaginaInicial() {
  const [requisicoes, setRequisicoes] = useState<RequisicaoResumo[]>([]);
  const [alcadas, setAlcadas] = useState<Alcada[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    Promise.all([listarRequisicoes(), listarAlcadas()])
      .then(([lista, faixas]) => {
        setRequisicoes(lista);
        setAlcadas(faixas);
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) return <p className="vazio">Carregando requisições...</p>;

  return (
    <>
      <div className="cabecalho-pagina">
        <h1>Requisições de Compra</h1>
        <a href="/nova" className="botao botao-nav">
          + Nova Requisição
        </a>
      </div>

      {erro && <p className="erro">{erro}</p>}

      {alcadas.length > 0 && (
        <p className="info">
          <strong>Alçadas:</strong>{" "}
          {alcadas.map((a) => (
            <span key={a.id} className="faixa">
              a partir de {formatarValor(a.valorMinimo)} → {a.aprovacoesNecessarias} aprovação(ões)
              {a.solicitantePodeAprovar ? " · solicitante pode aprovar" : ""}
            </span>
          ))}
        </p>
      )}

      {requisicoes.length === 0 && !erro && <p className="vazio">Nenhuma requisição registrada ainda.</p>}

      {requisicoes.map((r) => (
        <a key={r.id} href={`/requisicao/${r.id}`} className="card card-link">
          <div className="card-linha">
            <div>
              <h3>
                {codigo(r.id)} — {r.titulo}
              </h3>
              <p>
                Item: {r.item} · Qtd: {r.quantidade} · Solicitante: {r.solicitante}
              </p>
              <p>
                Cotações: {r.totalCotacoes}/{LIMITE_COTACOES} · Valor estimado:{" "}
                {r.valorEstimado ? formatarValor(r.valorEstimado) : "-"} · Criada em {formatarData(r.criadaEm)}
              </p>
            </div>
            <div className="tags">
              <span className={`tag tag-${r.status}`}>{r.status}</span>
              <span className={`tag tag-${r.prioridade}`}>{r.prioridade}</span>
            </div>
          </div>
        </a>
      ))}
    </>
  );
}
