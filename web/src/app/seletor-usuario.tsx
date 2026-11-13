"use client";

import { useEffect, useState } from "react";
import { Usuario, definirUsuarioAtual, usuarioAtualId } from "@/lib/api";
import { listarUsuarios } from "@/lib/requisicoes";

/** Login simulado: troca o usuario atual e recarrega a pagina. */
export default function SeletorUsuario() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [atual, setAtual] = useState<number>(1);

  useEffect(() => {
    setAtual(usuarioAtualId());
    listarUsuarios().then(setUsuarios).catch(() => setUsuarios([]));
  }, []);

  function trocar(id: number) {
    definirUsuarioAtual(id);
    window.location.reload();
  }

  return (
    <select className="seletor-usuario" value={atual} onChange={(e) => trocar(Number(e.target.value))}>
      {usuarios.length === 0 && <option value={atual}>Usuário #{atual}</option>}
      {usuarios.map((u) => (
        <option key={u.id} value={u.id}>
          {u.nome} ({u.papel})
        </option>
      ))}
    </select>
  );
}
