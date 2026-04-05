"use client";

import { useEffect } from "react";

const P = "[Filipe]";

/**
 * Regista erros globais na consola do browser (Inspecionar → Consola).
 */
export default function ClientErrorReporter() {
  useEffect(() => {
    const onError = (ev: ErrorEvent) => {
      console.error(P, "window.error", {
        message: ev.message,
        filename: ev.filename,
        lineno: ev.lineno,
        colno: ev.colno,
        error: ev.error,
      });
    };
    const onRejection = (ev: PromiseRejectionEvent) => {
      const r = ev.reason;
      console.error(P, "unhandledrejection", {
        reason: r,
        message: r instanceof Error ? r.message : String(r),
        stack: r instanceof Error ? r.stack : undefined,
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    console.info(P, "Diagnóstico cliente: erros globais são registados aqui. APIs: prefixo [Filipe:api].");
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
