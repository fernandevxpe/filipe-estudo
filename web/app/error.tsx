"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
      <h1 className="text-xl font-semibold text-white">Algo correu mal nesta página</h1>
      <p className="text-slate-400 text-sm break-words">{error.message || "Erro inesperado."}</p>
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
