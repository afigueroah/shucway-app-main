import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./ticket.css";

type TicketItem = {
  id: number | string;
  nombre: string;
  qty: number;
  precio: number;
  mods?: string | null;
  variante?: string | null;
  subtotal: number;
};

type TicketCliente = { nombre: string; telefono: string; nit: string } | null;

type TicketData = {
  ordenN: number;
  cliente: TicketCliente;
  items: TicketItem[];
  total: number;
  metodo: "efectivo" | "transferencia";
  efectivo: { dineroRecibido: number | null; cambio: number | null } | null;
  transferencia: { referencia: string; banco: string } | null;
  fechaHora: string;
  notas?: string;
};

const currency = (q: number) => `Q${q.toFixed(2)}`;

/** Parser de modificaciones a listas “- … / + …” */
function parseMods(mods?: string | null): { minus: string[]; plus: string[] } {
  const out = { minus: [] as string[], plus: [] as string[] };
  if (!mods) return out;

  const parts = mods.split("|").map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (/^sin\s/i.test(part)) {
      const items = part
        .replace(/^sin\s+/i, "")
        .split(/,\s*sin\s*/i)
        .map((s) => s.trim())
        .filter(Boolean);
      out.minus.push(...items);
    } else if (/^extra\s/i.test(part)) {
      const items = part
        .replace(/^extra\s+/i, "")
        .split(/,\s*extra\s*/i)
        .map((s) => s.trim())
        .filter(Boolean);
      out.plus.push(...items);
    }
  }
  return out;
}

const TOAST_DURATION = 2500;  // visible
const TOAST_ANIM = 280;       // ms anim enter/leave

const TicketVenta: React.FC = () => {
  const nav = useNavigate();
  const { state } = useLocation();
  const [data, setData] = useState<TicketData | null>(null);

  // Toast tipo login con animación de entrada/salida
  const [showToast, setShowToast] = useState(true);
  const [toastStage, setToastStage] = useState<"enter" | "leave">("enter");

  useEffect(() => {
    // temporizador para empezar salida
    const t1 = setTimeout(() => setToastStage("leave"), TOAST_DURATION);
    // y luego desmontar
    const t2 = setTimeout(() => setShowToast(false), TOAST_DURATION + TOAST_ANIM);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const closeToast = () => {
    setToastStage("leave");
    setTimeout(() => setShowToast(false), TOAST_ANIM);
  };

  // Cargar datos
  useEffect(() => {
    if (state) {
      setData(state as TicketData);
      return;
    }
    try {
      const raw = sessionStorage.getItem("ticketventa:last");
      if (raw) setData(JSON.parse(raw));
    } catch {
      // Ignorar errores de parseo del sessionStorage
    }
  }, [state]);

  // Fecha amigable
  const fechaStr = useMemo(() => {
    if (!data?.fechaHora) return "—";
    try {
      const d = new Date(data.fechaHora);
      return d.toLocaleString();
    } catch {
      return "—";
    }
  }, [data?.fechaHora]);

  const handlePrint = () => window.print();
  const handleNueva = () => nav("/ventas/ventas");

  const bulletStyle: React.CSSProperties = {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: 13,
    color: "var(--muted)",
    lineHeight: 1.4,
    paddingLeft: 10,
  };

  return (
    <div className="ticket-page">
      {/* Animaciones del toast (no imprime) */}
      <style>{`
        .toast-wrap {
          position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
          z-index: 50;
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translate(-50%, -10px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes toastOut {
          from { opacity: 1; transform: translate(-50%, 0); }
          to   { opacity: 0; transform: translate(-50%, -10px); }
        }
        .toast-enter { animation: toastIn ${TOAST_ANIM}ms ease-out both; }
        .toast-leave { animation: toastOut ${TOAST_ANIM}ms ease-in both; }
      `}</style>

      {showToast && (
        <div
          className={`no-print toast-wrap ${toastStage === "enter" ? "toast-enter" : "toast-leave"}`}
          aria-live="polite"
        >
          <div
            style={{
              background: "#fff",
              border: "1px solid #bbf7d0",
              padding: "10px 14px",
              borderRadius: 12,
              boxShadow: "0 10px 25px rgba(0,0,0,.08)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ color: "#059669", fontSize: 18 }}>✔</span>
            <span style={{ fontWeight: 600, color: "#111827" }}>
              Venta registrada exitosamente
            </span>
            <button
              onClick={closeToast}
              style={{ marginLeft: 6, color: "#9ca3af" }}
              aria-label="Cerrar"
              title="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Ticket */}
      <div id="ticket-root" className="ticket-paper">
        <div className="tk-header">
          <div className="tk-title">SHUCWAY</div>
        </div>

        <div className="tk-sep" />

        <div className="tk-row">
          <span className="tk-label">Orden</span>
          <span className="tk-value"> #{data?.ordenN ?? "—"}</span>
        </div>
        <div className="tk-row">
          <span className="tk-label">Fecha:</span>
          <span className="tk-value">{fechaStr}</span>
        </div>

        {data?.notas && (
          <>
            <div className="tk-sep" />
            <div className="tk-row">
              <span className="tk-label">Notas</span>
            </div>
            <div className="tk-row">
              <span className="tk-value">{data.notas}</span>
            </div>
          </>
        )}

        {data?.cliente && (
          <div className="tk-row">
            <span className="tk-label">Cliente: </span>
            <span className="tk-value">
              {data.cliente.nombre} &nbsp;Telefono: {data.cliente.telefono} &nbsp;NIT: {data.cliente.nit}
            </span>
          </div>
        )}

        <div className="tk-sep" />

        <div className="tk-row tk-muted">
          <span className="tk-label">Artículo</span>
          <span className="tk-value"> Subtotal </span>
        </div>

        {data?.items?.length ? (
          data.items.map((it, i) => {
            const { minus, plus } = parseMods(it.mods);
            return (
              <div key={`${it.id}-${i}`} style={{ marginBottom: 6 }}>
                <div className="tk-row">
                  <span className="tk-label">
                    {it.qty} x {it.nombre}
                  </span>
                  <span className="tk-value">{currency(it.subtotal)}</span>
                </div>

                {it.variante && (
                  <div style={bulletStyle}>Variante: {it.variante}</div>
                )}

                {minus.length > 0 && (
                  <div style={bulletStyle}>
                    {minus.map((m, idx) => (
                      <div key={`m-${idx}`}>- {m}</div>
                    ))}
                  </div>
                )}

                {plus.length > 0 && (
                  <div style={bulletStyle}>
                    {plus.map((p, idx) => (
                      <div key={`p-${idx}`}>+ {p}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="tk-row">
            <span className="tk-label">—</span>
            <span className="tk-value">—</span>
          </div>
        )}

        <div className="tk-sep" />

        <div className="tk-row tk-strong">
          <span className="tk-label">Total: </span>
          <span className="tk-value">{currency(data?.total ?? 0)}</span>
        </div>

        <div className="tk-row">
          <span className="tk-label">Método: </span>
          <span className="tk-value">
            {data?.metodo === "efectivo" ? "Efectivo" : "Transferencia"}
          </span>
        </div>

        {data?.metodo === "efectivo" && (
          <>
            <div className="tk-row">
              <span className="tk-label">Recibido: </span>
              <span className="tk-value">{currency(data?.efectivo?.dineroRecibido ?? 0)}</span>
            </div>
            <div className="tk-row">
              <span className="tk-label">Cambio: </span>
              <span className="tk-value">{currency(data?.efectivo?.cambio ?? 0)}</span>
            </div>
          </>
        )}

        {data?.metodo === "transferencia" && (
          <>
            <div className="tk-row">
              <span className="tk-label">Referencia</span>
              <span className="tk-value">{data.transferencia?.referencia || "—"}</span>
            </div>
            <div className="tk-row">
              <span className="tk-label">Banco</span>
              <span className="tk-value">{data.transferencia?.banco || "—"}</span>
            </div>
          </>
        )}

        <div className="tk-footer">
          <div className="tk-thanks">¡Gracias por su compra!</div>
          <div className="tk-dashes">- - - - - - - - - - -</div>
        </div>
      </div>

      <div className="ticket-actions no-print">
        <button className="btn" onClick={handlePrint}>Imprimir ticket</button>
        <button className="btn" onClick={handleNueva}>Ingresar otra venta</button>
      </div>
    </div>
  );
};

export default TicketVenta;
