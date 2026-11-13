import type { Metadata } from "next";
import "./globals.css";
import SeletorUsuario from "./seletor-usuario";

export const metadata: Metadata = {
  title: "Procurement | Solicitação de Compras Corporativas",
  description: "Requisição, 3 cotações, aprovação por alçadas e emissão da Ordem de Compra.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <header className="topo">
          <div className="topo-conteudo">
            <a href="/" className="logo">
              🛒 <span>Procurement</span>
            </a>
            <nav className="menu">
              <a href="/">Requisições</a>
              <a href="/nova" className="botao-nav">
                + Nova
              </a>
              <label className="rotulo-usuario">
                Usuário: <SeletorUsuario />
              </label>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="rodape">
          <p>PPW2 — Trabalho 3 · Solicitação de Compras Corporativas (Procurement)</p>
        </footer>
      </body>
    </html>
  );
}
