import React, { useEffect, useState } from "react";
import { Icon } from "../components/icons";
import { Button, Toggle, Badge } from "../components/ui";
import { ipc, isTauri } from "../lib/ipc";
export function Settings() {
  const [sources, setSources] = useState(() => {
    try {
      const raw = localStorage.getItem("hunt.enabledSources");
      if (raw) {
        const v = JSON.parse(raw);
        return { kp: v.kp !== false, halo: !!v.halo, limundo: !!v.limundo };
      }
    } catch {}
    return { kp: true, halo: false, limundo: false };
  });
  const [mono, setMono] = useState(false);
  const [backend, setBackend] = useState<string>("proveravam…");
  const [appVersion, setAppVersion] = useState<string>("—");
  const [cookies, setCookies] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);
  const [llmProvider, setLlmProvider] = useState<string>("");
  const [llmModel, setLlmModel] = useState<string>("");
  const [llmKey, setLlmKey] = useState<string>("");
  const [llmBaseUrl, setLlmBaseUrl] = useState<string>("");
  const [testPrompt, setTestPrompt] = useState<string>("Pročitaj ovaj oglas i vrati kratko: model iPhone-a, memorija, stanje baterije i oštećenja.\nNaslov: iPhone 13 Pro 256GB, baterija 84%, ogrebotina na ekranu\nOpis: Telefon radi odlično, Face ID radi, nema iCloud.");
  const [testStatus, setTestStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [testOutput, setTestOutput] = useState<string>("");

  useEffect(() => {
    (async () => {
      if (!isTauri()) {
        setBackend("Browser mod (bez Rust backenda)");
        setAppVersion("dev");
        return;
      }
      try {
        const { getVersion } = await import("@tauri-apps/api/app");
        setAppVersion(await getVersion());
      } catch {
        setAppVersion("—");
      }
      const res = await ipc.greet("lovac");
      setBackend(res ? `${res} · backend povezan` : "Backend nedostupan");
      const c = await ipc.cookiesStatus();
      setCookies(!!c);
      const cfg = await ipc.getLlmConfig();
      if (cfg) {
        setLlmProvider(cfg.provider || "");
        setLlmModel(cfg.model || "");
        setLlmKey(cfg.api_key || "");
        setLlmBaseUrl((cfg as any).base_url || "");
      }
    })();
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="label">06 — Podešavanja</div>
          <h1 className="page-title">
            Konfiguracija <em>skenera</em>.
          </h1>
          <p className="page-sub">
            Izvori, rate limit, ekstrakcija i izgled.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-h">
          <b>Rust backend</b>
          <Badge variant={backend.includes("povezan") ? "solid" : "outline"}>{backend.includes("povezan") ? "ONLINE" : "OFFLINE"}</Badge>
        </div>
        <div className="card-b">
          <div className="rowline">
            <div className="rowline-label">
              <b>Status</b>
              <span>{backend}</span>
            </div>
            <span className="mono">{isTauri() ? "Tauri IPC" : "Browser"}</span>
          </div>
        </div>
      </div>

      <div className="grid-side">
        <div className="stack">
          <div className="card">
            <div className="card-h">
              <b>Povezivanje (Cloudflare)</b>
            </div>
            <div className="card-b">
              <div className="rowline">
                <div className="rowline-label">
                  <b>KupujemProdajem</b>
                  <span>{cookies ? "Cookies uhvaćeni — scraper radi" : "Otvori browser, reši challenge, uhvati cookie-je"}</span>
                </div>
                <div className="hstack">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await ipc.connectSource("kp");
                      setToast("Prozor otvoren — reši Cloudflare, pa klikni 'Uhvati'");
                      setTimeout(() => setToast(null), 3200);
                    }}
                  >
                    Otvori
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={async () => {
                      const n = await ipc.captureCookies("kp");
                      if (n !== null) {
                        setCookies(true);
                        setToast(`Uhvaćeno ${n} cookie-ja`);
                        setTimeout(() => setToast(null), 3200);
                      } else {
                        setToast("Greška pri hvatanju cookie-ja");
                        setTimeout(() => setToast(null), 3200);
                      }
                    }}
                  >
                    Uhvati
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <b>Izvori</b>
            </div>
            <div className="card-b">
              <p className="faint" style={{ marginBottom: 10, fontSize: 11 }}>
                Isključi izvore koje ne želiš da koristiš za nabavljanje oglasa. “AI skeniraj KP” u Lov-u uvek skenira samo KP (prodaja, iPhone).
              </p>
              {[
                { k: "kp", label: "KupujemProdajem", desc: cookies ? "Cookies uhvaćeni" : "Poveži da rešiš Cloudflare" },
                { k: "halo", label: "HaloOglasi", desc: "Sekundarni izvor (može se isključiti)" },
                { k: "limundo", label: "Limundo / Kupindo", desc: "Aukcije (može se isključiti)" },
              ].map((s) => (
                <div key={s.k} className="rowline">
                  <div className="rowline-label">
                    <b>{s.label}</b>
                    <span>{s.desc}</span>
                  </div>
                  <div className="hstack">
                    {sources[s.k as keyof typeof sources] ? (
                      <Button size="sm" variant="ghost">
                        <Icon name="refresh" size={13} />
                        Test
                      </Button>
                    ) : (
                      <Button size="sm" variant="primary">
                        Poveži
                      </Button>
                    )}
                    <Toggle
                      on={sources[s.k as keyof typeof sources]}
                      onChange={(v) =>
                        setSources((x) => {
                          const next = { ...x, [s.k]: v };
                          try { localStorage.setItem("hunt.enabledSources", JSON.stringify(next)); } catch {}
                          return next;
                        })
                      }
                      label=""
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <b>Rate limit i ponašanje</b>
            </div>
            <div className="card-b">
              <div className="rowline">
                <div className="rowline-label">
                  <b>Zahtevi po domenu</b>
                  <span>1 zahtev / 2.5 s, max 2 paralelno</span>
                </div>
                <span className="mono">2.5s</span>
              </div>
              <div className="rowline">
                <div className="rowline-label">
                  <b>Aktivni sati</b>
                  <span>Samo 09:00–23:00</span>
                </div>
                <span className="mono">14h</span>
              </div>
              <div className="rowline">
                <div className="rowline-label">
                  <b>Keš HTML</b>
                  <span>TTL 30 minuta</span>
                </div>
                <span className="mono">30m</span>
              </div>
              <div className="rowline">
                <div className="rowline-label">
                  <b>Rizik buffer</b>
                  <span>+12% za nepoznato stanje</span>
                </div>
                <span className="mono">12%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h">
              <b>Ekstrakcija</b>
            </div>
            <div className="card-b">
              <div className="rowline">
                <div className="rowline-label">
                  <b>Heuristika</b>
                  <span>Regex + rečnik · ~70% oglasa · 0 ms</span>
                </div>
                <Badge variant="solid">Uključeno</Badge>
              </div>
              <div className="rowline">
                <div className="rowline-label">
                  <b>Heuristička ekstrakcija</b>
                  <span>Pokreni nad svim oglasima u bazi</span>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={async () => {
                    const n = await ipc.extractAll();
                    setToast(n === null ? "Nije dostupno (browser mod)" : `Ekstraktovano ${n} oglasa`);
                    setTimeout(() => setToast(null), 3200);
                  }}
                >
                  Ekstraktuj sve
                </Button>
              </div>
              <div className="rowline">
                <div className="rowline-label">
                  <b>Lokalni LLM</b>
                  <span>Qwen3-4B · GBNF · offline (stub)</span>
                </div>
                <Button size="sm" variant="ghost">
                  <Icon name="download" size={13} />
                  Preuzmi model
                </Button>
              </div>
              <div className="rowline">
                <div className="rowline-label">
                  <b>Cloud (opciono)</b>
                  <span>Groq / Gemini / OpenRouter · ključ u Credential Manageru</span>
                </div>
                <Button size="sm" variant="ghost">
                  Ključ
                </Button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <b>AI povezivanje (LLM)</b>
            </div>
            <div className="card-b">
              <p className="faint" style={{ marginBottom: 10, fontSize: 11 }}>
                Poveži bilo koji AI: lokalno (Ollama, LM Studio) ili cloud (Groq, Gemini, OpenRouter i drugi OpenAI-kompatibilni API-ji). AI čita oglase/slike i izvlači informacije.
              </p>
              <div style={{ marginBottom: 10 }}>
                <div className="label" style={{ marginBottom: 6 }}>Provajder</div>
                <select
                  className="select"
                  value={llmProvider}
                  onChange={(e) => setLlmProvider(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="">Heuristika (bez AI)</option>
                  <option value="ollama">Ollama (lokalno)</option>
                  <option value="groq">Groq</option>
                  <option value="gemini">Gemini</option>
                  <option value="openai">OpenAI-kompatibilan (bilo koji API / custom URL)</option>
                </select>
              </div>
              {(llmProvider === "ollama" || llmProvider === "openai") && (
                <div style={{ marginBottom: 10 }}>
                  <div className="label" style={{ marginBottom: 6 }}>Base URL (opciono)</div>
                  <input
                    className="input"
                    value={llmBaseUrl}
                    onChange={(e) => setLlmBaseUrl(e.target.value)}
                    placeholder={llmProvider === "ollama" ? "http://localhost:11434 (podrazumevano)" : "https://api.openai.com/v1 ili npr. https://openrouter.ai/api/v1, http://localhost:1234/v1"}
                    style={{ width: "100%" }}
                  />
                </div>
              )}
              <div style={{ marginBottom: 10 }}>
                <div className="label" style={{ marginBottom: 6 }}>Model</div>
                <input
                  className="input"
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  placeholder={
                    llmProvider === "ollama" ? "npr. qwen2.5:7b, llava, llama3.2-vision" :
                    llmProvider === "groq" ? "npr. llama-3.3-70b-versatile" :
                    llmProvider === "gemini" ? "npr. gemini-2.0-flash" :
                    llmProvider === "openai" ? "npr. gpt-4o-mini, openrouter model id..." : "naziv modela"
                  }
                  style={{ width: "100%" }}
                />
              </div>
              {(llmProvider === "groq" || llmProvider === "gemini" || llmProvider === "openai") && (
                <div style={{ marginBottom: 10 }}>
                  <div className="label" style={{ marginBottom: 6 }}>API ključ {llmProvider === "openai" ? "(ako je potreban)" : ""}</div>
                  <input
                    className="input"
                    type="password"
                    value={llmKey}
                    onChange={(e) => setLlmKey(e.target.value)}
                    placeholder={llmProvider === "openai" ? "API key (ostavi prazno za lokalni endpoint bez ključa)" : "API ključ"}
                    style={{ width: "100%" }}
                  />
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={async () => {
                    await ipc.setLlmConfig(llmProvider, llmModel, llmKey, llmBaseUrl);
                    setToast("AI podešavanja sačuvana");
                    setTimeout(() => setToast(null), 2400);
                  }}
                >
                  Sačuvaj
                </Button>
                <span className="faint" style={{ fontSize: 11 }}>
                  {llmProvider === "ollama" ? "Podrazumevano: http://localhost:11434" :
                   llmProvider === "openai" ? "Radi sa OpenAI, OpenRouter, LM Studio, Together, vLLM i sl." :
                   llmProvider ? "Cloud provajder" : "Bez AI (samo heuristika)"}
                </span>
              </div>

              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border, #333)" }}>
                <div className="label" style={{ marginBottom: 6 }}>Brzi test AI veze</div>
                <textarea
                  className="input"
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  rows={3}
                  style={{ width: "100%", resize: "vertical", fontFamily: "inherit" }}
                  placeholder="Unesi test poruku za AI..."
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={testStatus === "loading" || !llmProvider}
                    onClick={async () => {
                      await ipc.setLlmConfig(llmProvider, llmModel, llmKey, llmBaseUrl);
                      setTestStatus("loading");
                      setTestOutput("Čeka se odgovor AI... (može potrajati nekoliko sekundi)");
                      try {
                        const { invoke } = await import("@tauri-apps/api/core");
                        const res = await invoke<string>("test_llm", { prompt: testPrompt });
                        setTestOutput(res || "(prazan odgovor)");
                        setTestStatus("ok");
                      } catch (e: any) {
                        const msg = typeof e === "string" ? e : (e?.message || String(e));
                        setTestOutput("Greška: " + msg);
                        setTestStatus("error");
                      }
                    }}
                  >
                    {testStatus === "loading" ? "Čekam AI…" : "Testiraj AI"}
                  </Button>
                  {testStatus === "loading" && <span className="faint" style={{ fontSize: 11 }}>⏳ Komunikacija sa modelom u toku…</span>}
                  {testStatus === "ok" && <Badge variant="solid">OK</Badge>}
                  {testStatus === "error" && <Badge variant="risk">Greška</Badge>}
                </div>
                <div style={{ marginTop: 8 }}>
                  <div className="label" style={{ marginBottom: 6 }}>Odgovor AI</div>
                  <pre style={{
                    margin: 0,
                    padding: 10,
                    borderRadius: 8,
                    background: "var(--panel, rgba(255,255,255,0.04))",
                    border: "1px solid var(--border, #333)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    minHeight: 64,
                    maxHeight: 220,
                    overflow: "auto",
                    fontSize: 12,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    opacity: testOutput ? 1 : 0.6
                  }}>
                    {testOutput || "Ovde će se prikazati odgovor modela nakon testa."}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <b>Izgled</b>
            </div>
            <div className="card-b">
              <div className="rowline">
                <div className="rowline-label">
                  <b>Monohrom</b>
                  <span>Isključi boje profita (samo crno-belo)</span>
                </div>
                <Toggle on={mono} onChange={setMono} label="" />
              </div>
              <div className="rowline">
                <div className="rowline-label">
                  <b>Grain tekstura</b>
                  <span>Subtilni šum preko ekrana</span>
                </div>
                <Toggle on={true} onChange={() => {}} label="" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <b>Podaci</b>
            </div>
            <div className="card-b">
              <div className="rowline">
                <div className="rowline-label">
                  <b>Verzija aplikacije</b>
                  <span>Trenutno instalirana verzija</span>
                </div>
                <span className="mono">v{appVersion}</span>
              </div>
              <div className="rowline">
                <div className="rowline-label">
                  <b>Proveri ažuriranja</b>
                  <span>Tauri updater · GitHub Releases</span>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={async () => {
                    if (!isTauri()) {
                      setToast("Nije dostupno (browser mod)");
                      setTimeout(() => setToast(null), 2400);
                      return;
                    }
                    try {
                      const { check } = await import("@tauri-apps/plugin-updater");
                      const update = await check();
                      if (update?.available) {
                        setToast(`Nova verzija ${update.version} — preuzimam…`);
                        await update.downloadAndInstall();
                        setToast("Instalirano — restartuj aplikaciju");
                      } else {
                        setToast("Već imaš najnoviju verziju");
                      }
                    } catch (e) {
                      const msg = String(e);
                      if (msg.includes("404")) {
                        setToast("Greška ažuriranja (404): proveri endpoint/latest.json. " + msg.slice(0, 100));
                      } else if (msg.includes("not found") || msg.includes("Could not fetch")) {
                        setToast("Greška ažuriranja: " + msg.slice(0, 140));
                      } else {
                        setToast("Greška: " + msg.slice(0, 140));
                      }
                    }
                    setTimeout(() => setToast(null), 4000);
                  }}
                >
                  Proveri
                </Button>
              </div>
              <div className="rowline">
                <div className="rowline-label">
                  <b>Backup baze</b>
                  <span>Jedan fajl · %APPDATA%</span>
                </div>
                <Button size="sm" variant="ghost">
                  <Icon name="download" size={13} />
                  Export
                </Button>
              </div>
              <div className="rowline">
                <div className="rowline-label">
                  <b>Export CSV</b>
                  <span>Svi oglasi + kalkulacija</span>
                </div>
                <Button size="sm" variant="ghost">
                  Export
                </Button>
              </div>
              <div className="rowline">
                <div className="rowline-label">
                  <b>Obriši sve oglase</b>
                  <span>Uklanja sve učitane oglase, slike i izvučene podatke iz baze</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (!isTauri()) { setToast("Nije dostupno (browser mod)"); setTimeout(() => setToast(null), 2400); return; }
                    const ok = window.confirm("Da li sigurno želiš da obrišeš sve učitane oglase? Ova akcija se ne može poništiti.");
                    if (!ok) return;
                    try {
                      const { invoke } = await import("@tauri-apps/api/core");
                      const n = await invoke<number>("clear_listings");
                      setToast(`Obrisano oglasa: ${n}`);
                    } catch (e) {
                      setToast("Greška pri brisanju: " + String(e).slice(0, 120));
                    }
                    setTimeout(() => setToast(null), 3200);
                  }}
                >
                  Obriši sve
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
