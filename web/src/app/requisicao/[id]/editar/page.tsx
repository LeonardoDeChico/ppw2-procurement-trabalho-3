"use client";

import { use, useEffect, useState } from "react";
import { Requisicao, codigo } from "@/lib/api";
import { atualizarRequisicao, buscarRequisicao } from "@/lib/requisicoes";
import FormularioRequisicao from "../../../formulario-requisicao";

export default function EditarRequisicaoPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number(use(params).id);
  const [requisicao, setRequisicao] = useState<Requisicao | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    buscarRequisicao(id).then(setRequisicao).catch((e) => setErro(e.message));
  }, [id]);

  if (erro) return <p className="erro">{erro}</p>;
  if (!requisicao) return <p className="vazio">Carregando...</p>;

  return (
    <>
      <div className="cabecalho-pagina">
        <h1>Alterar {codigo(requisicao.id)}</h1>
        <a href={`/requisicao/${id}`} className="botao botao-cinza">
          ← Voltar
        </a>
      </div>

      <FormularioRequisicao
        inicial={{ ...requisicao, justificativa: requisicao.justificativa ?? "" }}
        textoBotao="Salvar alterações"
        aoSalvar={async (dados) => {
          await atualizarRequisicao(id, dados);
          window.location.href = `/requisicao/${id}`;
        }}
      />
    </>
  );
}
