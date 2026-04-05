"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Filipe] error.tsx (página)", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      error,
    });
  }, [error]);

  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
      <h1 className="text-xl font-semibold text-white">Algo correu mal nesta página</h1>
      <p className="text-slate-400 text-sm break-words">{error.message || "Erro inesperado."}</p>
      {error.digest ? (
        <p className="text-xs text-slate-500">
          Digest: <code className="text-slate-400">{error.digest}</code>
        </p>
      ) : null}
      <details className="text-left text-xs text-slate-500 max-w-full mx-auto">
        <summary className="cursor-pointer text-sky-500 hover:text-sky-400">Detalhe técnico (consola F12)</summary>
        <p className="mt-2 break-all font-mono text-[11px] text-slate-600">
          O stack completo foi enviado para <code className="text-slate-500">console.error</code> com o prefixo{" "}
          <code className="text-slate-500">[Filipe]</code>.
        </p>
      </details>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium px-4 py-2"
      >
        Tentar de novo
      </button>
    </div>
  );
}
