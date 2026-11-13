"use client";

import { criarRequisicao } from "@/lib/requisicoes";
import FormularioRequisicao from "../formulario-requisicao";

export default function NovaRequisicaoPage() {
  return (
    <>
      <div className="cabecalho-pagina">
        <h1>Nova Requisição de Compra</h1>
        <a href="/" className="botao botao-cinza">
          ← Voltar
        </a>
      </div>

      <p className="info">O solicitante será o usuário selecionado no topo da página.</p>

      <FormularioRequisicao
        textoBotao="Abrir Requisição"
        aoSalvar={async (dados) => {
          const criada = await criarRequisicao(dados);
          window.location.href = `/requisicao/${criada.id}`;
        }}
      />
    </>
  );
}
