import React, { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui";
import { Icon } from "../components/icons";
import { eur } from "../lib/format";
import { ipc } from "../lib/ipc";

type PartDef = { key: string; label: string };
const PARTS: PartDef[] = [
  { key: "display", label: "Ekran (display)" },
  { key: "battery", label: "Baterija" },
  { key: "back_glass", label: "Zadnje staklo/kućište" },
  { key: "camera_rear", label: "Zadnja kamera" },
  { key: "camera_front", label: "Prednja kamera" },
  { key: "charging_port", label: "Konektor punjenja" },
  { key: "speaker", label: "Zvučnik (donji)" },
  { key: "earpiece", label: "Slušalica (earpiece)" },
  { key: "faceid", label: "Face ID / TrueDepth" },
  { key: "frame", label: "Ram/kućište (frame)" },
];

const DEFAULT_MODELS = [
  "iPhone 8", "iPhone 8 Plus", "iPhone X", "iPhone XR", "iPhone XS", "iPhone XS Max",
  "iPhone 11", "iPhone 11 Pro", "iPhone 11 Pro Max",
  "iPhone 12 mini", "iPhone 12", "iPhone 12 Pro", "iPhone 12 Pro Max",
  "iPhone 13 mini", "iPhone 13", "iPhone 13 Pro", "iPhone 13 Pro Max",
  "iPhone 14", "iPhone 14 Plus", "iPhone 14 Pro", "iPhone 14 Pro Max",
  "iPhone 15", "iPhone 15 Plus", "iPhone 15 Pro", "iPhone 15 Pro Max",
  "iPhone 16", "iPhone 16 Plus", "iPhone 16 Pro", "iPhone 16 Pro Max",
  "iPhone SE (2nd)", "iPhone SE (3rd)",
];

type PriceRow = { model: string; part: string; quality: string; price_eur: number; labor_eur: number; supplier?: string; note?: string; updated_at?: string };
const keyOf = (m: string, p: string) => `${m}||${p}`;

function seedDefaults(): Record<string, PriceRow> {
  // Rough baseline estimates (EUR) for parts/labor - user can edit to current market prices
  const base: Record<string, number> = { display: 90, battery: 25, back_glass: 30, camera_rear: 35, camera_front: 20, charging_port: 20, speaker: 15, earpiece: 15, faceid: 45, frame: 40 };
  const laborBase: Record<string, number> = { display: 25, battery: 15, back_glass: 25, camera_rear: 20, camera_front: 15, charging_port: 20, speaker: 15, earpiece: 15, faceid: 30, frame: 35 };
  const mult = (m: string) => {
    const s = m.toLowerCase();
    if (s.includes("16")) return 1.6;
    if (s.includes("15")) return 1.35;
    if (s.includes("14")) return 1.2;
    if (s.includes("13")) return 1.1;
    if (s.includes("12")) return 1.0;
    if (s.includes("11")) return 0.9;
    if (s.includes("x") || s.includes("xs") || s.includes("xr")) return 0.8;
    if (s.includes("se")) return 0.7;
    return 0.75;
  };
  const map: Record<string, PriceRow> = {};
  for (const m of DEFAULT_MODELS) {
    const k = mult(m);
    for (const p of PARTS) {
      map[keyOf(m, p.key)] = {
        model: m, part: p.key, quality: "standard",
        price_eur: Math.round((base[p.key] || 20) * k),
        labor_eur: Math.round((laborBase[p.key] || 15) * (0.8 + k * 0.4)),
        supplier: "", note: "procenjena cena - ažuriraj po nabavci", updated_at: ""
      };
    }
  }
  return map;
}

export function Repairs() {
  const [models, setModels] = useState<string[]>(DEFAULT_MODELS);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODELS[10] || DEFAULT_MODELS[0]);
  const [prices, setPrices] = useState<Record<string, PriceRow>>(() => seedDefaults());
  const [filter, setFilter] = useState("");
  const [newModel, setNewModel] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");

  const parsePricesJson = (res: string) => {
    let obj: any = null;
    try { obj = JSON.parse(res); } catch { const m = res.match(/\{[\s\S]*\}/); if (m) obj = JSON.parse(m[0]); }
    return obj;
  };

  const askAiPricesForModel = async (model: string, saveAfter = false) => {
    const { invoke } = await import("@tauri-apps/api/core");
    const prompt = `Istraži i proceni trenutne realne cene delova za ${model} u SRBIJI (servisi, dobavljači delova, oglasi/tržište). Vrati ISKLJUČIVO JSON objekat bez teksta van JSON-a, format:
{"display":{"part":EUR,"labor":EUR},"battery":{"part":EUR,"labor":EUR},"back_glass":{"part":EUR,"labor":EUR},"camera_rear":{"part":EUR,"labor":EUR},"camera_front":{"part":EUR,"labor":EUR},"charging_port":{"part":EUR,"labor":EUR},"speaker":{"part":EUR,"labor":EUR},"earpiece":{"part":EUR,"labor":EUR},"faceid":{"part":EUR,"labor":EUR},"frame":{"part":EUR,"labor":EUR}}
- part = cena dela (nabavka/rezervni deo) u EUR
- labor = cena rada/zamene u servisu u EUR (tipično za Srbiju)
- koristi realne trenutne procene za Srbiju; ako deo nije primenjiv stavi 0. Samo brojevi.`;
    const res = await invoke<string>("test_llm", { prompt });
    const obj = parsePricesJson(res);
    if (!obj) throw new Error("AI nije vratio ispravan JSON za " + model);
    setPrices(prev => {
      const map = { ...prev };
      for (const p of PARTS) {
        const v = obj[p.key];
        if (!v) continue;
        const k = keyOf(model, p.key);
        map[k] = {
          ...(map[k] || { model, part: p.key, quality: "standard", price_eur: 0, labor_eur: 0 }),
          price_eur: Number(v.part) || 0,
          labor_eur: Number(v.labor) || 0,
          note: "AI procena (Srbija) - proveri pre nabavke",
          updated_at: new Date().toISOString(),
        };
      }
      return map;
    });
    if (saveAfter) {
      for (const p of PARTS) {
        const v = obj[p.key] || {};
        await ipc.upsertPartPrice({
          model, part: p.key, quality: "standard",
          price_eur: Number(v.part) || 0, labor_eur: Number(v.labor) || 0,
          supplier: "", note: "AI procena (Srbija) - proveri pre nabavke"
        });
      }
    }
  };

  const load = async () => {
    setLoading(true);
    const rows = await ipc.listPartsPrices();
    if (rows && Array.isArray(rows) && rows.length > 0) {
      const map = { ...seedDefaults() };
      const ms = new Set<string>(DEFAULT_MODELS);
      for (const r of rows) {
        const model = r.model || "";
        const part = r.part || "";
        if (!model || !part) continue;
        ms.add(model);
        map[keyOf(model, part)] = {
          model, part, quality: r.quality || "standard",
          price_eur: Number(r.price_eur) || 0,
          labor_eur: Number(r.labor_eur) || 0,
          supplier: r.supplier || "",
          note: r.note || "",
          updated_at: r.updated_at || "",
        };
      }
      setPrices(map);
      const merged = Array.from(ms).sort((a,b)=>a.localeCompare(b, undefined, {numeric:true}));
      setModels(merged);
      if (!merged.includes(selectedModel)) setSelectedModel(merged[0] || selectedModel);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filteredModels = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return models;
    return models.filter(m => m.toLowerCase().includes(q));
  }, [models, filter]);

  const rowsForModel = PARTS.map(p => prices[keyOf(selectedModel, p.key)] || { model: selectedModel, part: p.key, quality: "standard", price_eur: 0, labor_eur: 0 });

  const updateCell = (part: string, field: "price_eur"|"labor_eur"|"supplier"|"note", value: any) => {
    const k = keyOf(selectedModel, part);
    setPrices(prev => ({ ...prev, [k]: { ...(prev[k] || { model: selectedModel, part, quality: "standard", price_eur: 0, labor_eur: 0 }), [field]: value } }));
  };

  const saveModel = async () => {
    for (const p of PARTS) {
      const r = prices[keyOf(selectedModel, p.key)];
      if (r) await ipc.upsertPartPrice(r);
    }
    setToast(`Sačuvane cene delova za ${selectedModel}`);
    setTimeout(() => setToast(null), 2600);
  };

  const addModel = () => {
    const m = newModel.trim();
    if (!m) return;
    if (!models.includes(m)) {
      const next = [...models, m].sort((a,b)=>a.localeCompare(b, undefined, {numeric:true}));
      setModels(next);
      setPrices(prev => {
        const map = { ...prev };
        for (const p of PARTS) if (!map[keyOf(m,p.key)]) map[keyOf(m,p.key)] = { model: m, part: p.key, quality: "standard", price_eur: 0, labor_eur: 0 };
        return map;
      });
    }
    setSelectedModel(m);
    setNewModel("");
  };

  const askAiPrices = async () => {
    setAiBusy(true); setProgress(`Istražujem cene za ${selectedModel} (Srbija)...`);
    try {
      await askAiPricesForModel(selectedModel, false);
      setToast(`AI procena cena učitana za ${selectedModel} (Srbija). Proveri i sačuvaj.`);
    } catch (e) {
      setToast("AI ažuriranje nije uspelo: " + String(e).slice(0, 160) + " (proveri AI podešavanja)");
    }
    setAiBusy(false); setProgress("");
    setTimeout(() => setToast(null), 4000);
  };

  const askAiAllPrices = async () => {
    if (!window.confirm(`AI će pokušati da istraži i proceni cene svih delova za ${models.length} modela (cene u Srbiji). Ovo može potrajati. Nastavi?`)) return;
    setAiBusy(true);
    let ok = 0, fail = 0;
    for (let i = 0; i < models.length; i++) {
      const m = models[i];
      setProgress(`AI istražuje cene (Srbija): ${i + 1}/${models.length} — ${m}...`);
      try {
        await askAiPricesForModel(m, true);
        ok++;
      } catch (e) {
        fail++;
      }
      await new Promise(r => setTimeout(r, 400));
    }
    setAiBusy(false); setProgress("");
    setToast(`Završeno: ${ok} modela ažurirano, ${fail} neuspešno. Proveri cene i ispravi po potrebi.`);
    setTimeout(() => setToast(null), 5000);
    await load();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label">01 — Popravke</div>
          <h1 className="page-title">Cene <em>delova</em> za iPhone.</h1>
          <p className="page-sub">Organizovan cenovnik delova i rada po modelima. Uredi i sačuvaj trenutne nabavne/servisne cene (koristi se u kalkulacijama i planiranju popravki).</p>
        </div>
        <div className="head-meta">
          <span>Modela <b>{models.length}</b></span>
          <span>Delova po modelu <b>{PARTS.length}</b></span>
        </div>
      </div>

      <div className="grid-side">
        <div className="card">
          <div className="card-h"><b>Modeli iPhone</b></div>
          <div className="card-b" style={{ paddingBottom: 8 }}>
            <input className="input" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Pretraga modela..." style={{ width: "100%", marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 6 }}>
              <input className="input" value={newModel} onChange={(e) => setNewModel(e.target.value)} placeholder="Dodaj model (npr. iPhone 17 Pro)" style={{ width: "100%" }} />
              <Button size="sm" variant="ghost" onClick={addModel}><Icon name="plus" size={13} /></Button>
            </div>
          </div>
          <div className="model-list" style={{ maxHeight: 520, overflow: "auto" }}>
            {filteredModels.map((m) => (
              <button key={m} className={`model-row${selectedModel === m ? " is-active" : ""}`} onClick={() => setSelectedModel(m)}>
                <div className="grow">
                  <b>{m}</b>
                  <span>uredi cene delova i rada</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h">
              <b>{selectedModel} — cenovnik delova</b>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Button size="sm" variant="ghost" onClick={askAiPrices} disabled={aiBusy}>
                  {aiBusy ? "AI radi…" : "AI cene (model)"}
                </Button>
                <Button size="sm" variant="ghost" onClick={askAiAllPrices} disabled={aiBusy}>
                  {aiBusy ? "AI radi…" : "AI cene (svi modeli, Srbija)"}
                </Button>
                <Button size="sm" variant="primary" onClick={saveModel} disabled={loading}>
                  Sačuvaj model
                </Button>
              </div>
            </div>
            <div className="card-b" style={{ padding: 0, overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Deo</th>
                    <th className="num">Cena dela (€)</th>
                    <th className="num">Rad (€)</th>
                    <th>Dobavljač</th>
                    <th>Napomena</th>
                    <th>Ažurirano</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsForModel.map((r, i) => {
                    const pdef = PARTS[i];
                    const upd = r.updated_at ? String(r.updated_at).slice(0, 10) : "—";
                    return (
                      <tr key={pdef.key}>
                        <td><b>{pdef.label}</b></td>
                        <td className="num" style={{ minWidth: 110 }}>
                          <input className="input" type="number" step="1" value={r.price_eur || 0}
                            onChange={(e) => updateCell(pdef.key, "price_eur", parseFloat(e.target.value) || 0)}
                            style={{ width: 90, textAlign: "right" }} />
                        </td>
                        <td className="num" style={{ minWidth: 110 }}>
                          <input className="input" type="number" step="1" value={r.labor_eur || 0}
                            onChange={(e) => updateCell(pdef.key, "labor_eur", parseFloat(e.target.value) || 0)}
                            style={{ width: 90, textAlign: "right" }} />
                        </td>
                        <td style={{ minWidth: 140 }}>
                          <input className="input" value={r.supplier || ""} onChange={(e) => updateCell(pdef.key, "supplier", e.target.value)} placeholder="dobavljač / link" style={{ width: "100%" }} />
                        </td>
                        <td style={{ minWidth: 180 }}>
                          <input className="input" value={r.note || ""} onChange={(e) => updateCell(pdef.key, "note", e.target.value)} placeholder="napomena" style={{ width: "100%" }} />
                        </td>
                        <td className="mono" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{upd}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="card-b">
              {aiBusy && progress && <div className="faint" style={{ marginBottom: 8, fontSize: 12 }}>⏳ {progress}</div>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span className="faint" style={{ fontSize: 11 }}>Ukupno delovi (svi): <b>{eur(rowsForModel.reduce((a,r)=>a+(r.price_eur||0),0))}</b> · Ukupno rad: <b>{eur(rowsForModel.reduce((a,r)=>a+(r.labor_eur||0),0))}</b></span>
                <span style={{ flex: 1 }} />
                <Button size="sm" variant="ghost" onClick={load}><Icon name="refresh" size={13} /> Učitaj iz baze</Button>
                <Button size="sm" variant="primary" onClick={saveModel}>Sačuvaj sve za model</Button>
              </div>
              <p className="faint" style={{ marginTop: 8, fontSize: 11 }}>
                Savet: “AI cene (model)” i “AI cene (svi modeli, Srbija)” koriste podešeni AI (npr. OpenRouter) da proceni cene delova i rada specifično za Srbiju. AI daje procene (ne garantuje realne nabavne cene) — proveri kod dobavljača/servisa i sačuvaj tačne vrednosti.
              </p>
            </div>
          </div>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
