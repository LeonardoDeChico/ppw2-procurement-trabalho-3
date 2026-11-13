"use client";

import { useState } from "react";
import { DadosRequisicao } from "@/lib/api";

type Props = {
  inicial?: DadosRequisicao;
  textoBotao: string;
  aoSalvar: (dados: DadosRequisicao) => Promise<void>;
};

/** Formulario usado na inclusao e na alteracao. O backend valida tudo de novo. */
export default function FormularioRequisicao({ inicial, textoBotao, aoSalvar }: Props) {
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [item, setItem] = useState(inicial?.item ?? "");
  const [quantidade, setQuantidade] = useState(String(inicial?.quantidade ?? 1));
  const [centroCusto, setCentroCusto] = useState(inicial?.centroCusto ?? "");
  const [prioridade, setPrioridade] = useState(inicial?.prioridade ?? "MEDIA");
  const [justificativa, setJustificativa] = useState(inicial?.justificativa ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setSalvando(true);

    try {
      await aoSalvar({
        titulo,
        item,
        quantidade: Number(quantidade),
        centroCusto,
        prioridade,
        justificativa: justificativa || undefined,
      });
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar");
      setSalvando(false);
    }
  }

  return (
    <form className="formulario" onSubmit={enviar}>
      {erro && <p className="erro">{erro}</p>}

      <div className="campo">
        <label htmlFor="titulo">Título</label>
        <input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
      </div>

      <div className="grade-2">
        <div className="campo">
          <label htmlFor="item">Item</label>
          <input id="item" value={item} onChange={(e) => setItem(e.target.value)} required />
        </div>
        <div className="campo">
          <label htmlFor="quantidade">Quantidade</label>
          <input
            id="quantidade"
            type="number"
            min="1"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grade-2">
        <div className="campo">
          <label htmlFor="centroCusto">Centro de Custo</label>
          <input id="centroCusto" value={centroCusto} onChange={(e) => setCentroCusto(e.target.value)} required />
        </div>
        <div className="campo">
          <label htmlFor="prioridade">Prioridade</label>
          <select id="prioridade" value={prioridade} onChange={(e) => setPrioridade(e.target.value)}>
            <option value="BAIXA">BAIXA</option>
            <option value="MEDIA">MÉDIA</option>
            <option value="ALTA">ALTA</option>
          </select>
        </div>
      </div>

      <div className="campo">
        <label htmlFor="justificativa">Justificativa</label>
        <textarea id="justificativa" rows={3} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
      </div>

      <button className="botao" type="submit" disabled={salvando}>
        {salvando ? "Salvando..." : textoBotao}
      </button>
    </form>
  );
}
