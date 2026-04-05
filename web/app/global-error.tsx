"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Filipe] global-error (falha no layout raiz)", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      error,
    });
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#0f172a",
          color: "#e2e8f0",
          padding: 24,
          minHeight: "100vh",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Erro na aplicação</h1>
        <p style={{ color: "#94a3b8", fontSize: 14, maxWidth: 560 }}>{error.message || "Erro inesperado."}</p>
        {error.digest ? (
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 12 }}>
            Digest Next.js: <code style={{ color: "#94a3b8" }}>{error.digest}</code>
            <br />
            Abre as ferramentas de programador (F12) → Consola para o registo completo.
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: 20,
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            background: "#0284c7",
            color: "#fff",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
