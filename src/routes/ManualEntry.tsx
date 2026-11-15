import React, { useState } from "react";
import { Button } from "../components/ui";
import { Icon } from "../components/icons";
import { ipc } from "../lib/ipc";

export function ManualEntry() {
  const [form, setForm] = useState({
    title: "",
    model: "",
    storage: "128",
    price: "",
    location: "",
    seller: "",
    description: "",
    battery: "",
    icloud: false,
    carrierLocked: false,
    screenReplaced: false,
    damage: "working",
    notes: "",
  });
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label">02 — Ručni unos</div>
          <h1 className="page-title">Ručni <em>unos podataka</em>.</h1>
          <p className="page-sub">Unesi telefon/oglas ručno sa svim informacijama (model, stanje, cena, napomene). Podaci se čuvaju u bazi.</p>
        </div>
      </div>

      <div className="grid-side">
        <div className="card">
          <div className="card-h"><b>Osnovni podaci</b></div>
          <div className="card-b">
            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div className="label" style={{ marginBottom: 6 }}>Naslov</div>
                <input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="npr. iPhone 13 Pro 256GB - razbijen ekran" style={{ width: "100%" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
                <div>
                  <div className="label" style={{ marginBottom: 6 }}>Model</div>
                  <input className="input" value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="iPhone 13 Pro" style={{ width: "100%" }} />
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 6 }}>Memorija (GB)</div>
                  <input className="input" value={form.storage} onChange={(e) => set("storage", e.target.value)} placeholder="128" style={{ width: "100%" }} />
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 6 }}>Cena (€)</div>
                  <input className="input" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="250" style={{ width: "100%" }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <div className="label" style={{ marginBottom: 6 }}>Lokacija</div>
                  <input className="input" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Beograd" style={{ width: "100%" }} />
                </div>
                <div>
                  <div className="label" style={{ marginBottom: 6 }}>Prodavac/kontakt</div>
                  <input className="input" value={form.seller} onChange={(e) => set("seller", e.target.value)} placeholder="ime, telefon..." style={{ width: "100%" }} />
                </div>
              </div>
              <div>
                <div className="label" style={{ marginBottom: 6 }}>Opis</div>
                <textarea className="input" rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Opis stanja, dogovor, napomene prodavca..." style={{ width: "100%", resize: "vertical" }} />
              </div>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h"><b>Stanje i atributi</b></div>
            <div className="card-b">
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <div className="label" style={{ marginBottom: 6 }}>Baterija (%)</div>
                    <input className="input" value={form.battery} onChange={(e) => set("battery", e.target.value)} placeholder="npr. 84" style={{ width: "100%" }} />
                  </div>
                  <div>
                    <div className="label" style={{ marginBottom: 6 }}>Oštećenje/stanje</div>
                    <select className="select" value={form.damage} onChange={(e) => set("damage", e.target.value)} style={{ width: "100%" }}>
                      <option value="working">Ispravan</option>
                      <option value="screen">Ekran</option>
                      <option value="battery">Baterija</option>
                      <option value="back">Zadnje staklo</option>
                      <option value="faceid">Face ID</option>
                      <option value="camera">Kamera</option>
                      <option value="water">Voda</option>
                      <option value="no_power">Ne pali/ne radi</option>
                    </select>
                  </div>
                </div>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                  <input type="checkbox" checked={form.icloud} onChange={(e) => set("icloud", e.target.checked)} /> iCloud zaključan
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                  <input type="checkbox" checked={form.carrierLocked} onChange={(e) => set("carrierLocked", e.target.checked)} /> SIM/carrier zaključan
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                  <input type="checkbox" checked={form.screenReplaced} onChange={(e) => set("screenReplaced", e.target.checked)} /> Menjan ekran
                </label>
                <div>
                  <div className="label" style={{ marginBottom: 6 }}>Interne napomene</div>
                  <textarea className="input" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Plan popravke, troškovi, dogovor..." style={{ width: "100%", resize: "vertical" }} />
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><b>Sačuvaj</b></div>
            <div className="card-b">
              <p className="faint" style={{ marginBottom: 10, fontSize: 11 }}>
                Ručni unos se čuva kao zapis u bazi (izvor: ručno). Možeš ga kasnije koristiti za kalkulaciju i evidenciju.
              </p>
              <Button
                size="sm"
                variant="primary"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    const { invoke } = await import("@tauri-apps/api/core");
                    await invoke("save_manual_listing", {
                      data: {
                        title: form.title || `${form.model} ${form.storage}GB`,
                        model: form.model,
                        storage: parseInt(form.storage) || 0,
                        price: parseFloat(form.price) || 0,
                        location: form.location,
                        seller: form.seller,
                        description: [form.description, form.notes ? `Napomene: ${form.notes}` : ""].filter(Boolean).join("\n"),
                        battery: form.battery ? parseInt(form.battery) : null,
                        icloud: form.icloud,
                        carrier_locked: form.carrierLocked,
                        screen_replaced: form.screenReplaced,
                        damage: [form.damage],
                      }
                    });
                    setToast("Sačuvano (ručni unos)");
                    setForm({ title: "", model: "", storage: "128", price: "", location: "", seller: "", description: "", battery: "", icloud: false, carrierLocked: false, screenReplaced: false, damage: "working", notes: "" });
                  } catch (e) {
                    setToast("Greška: " + String(e).slice(0, 140));
                  }
                  setSaving(false);
                  setTimeout(() => setToast(null), 3200);
                }}
              >
                <Icon name="plus" size={13} /> {saving ? "Čuvam…" : "Sačuvaj unos"}
              </Button>
            </div>
          </div>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
