"use client";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { diasAte, type StatusDoc } from "@/lib/catalogo-docs";

export const pillStatus = (s: StatusDoc, validade: string | null) => {
  const d = diasAte(validade);
  if (s === "vencido") return <span className="pill bad"><AlertTriangle /> Vencido</span>;
  if (s === "vence_logo") return <span className="pill warn"><Clock /> Vence em {d} dia{d === 1 ? "" : "s"}</span>;
  if (s === "ok") return <span className="pill ok"><CheckCircle2 /> Válido</span>;
  return <span className="pill gray">Sem validade</span>;
};
