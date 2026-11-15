import React, { useEffect, useState } from "react";
import { Icon } from "../components/icons";
import { Button, Toggle, Badge } from "../components/ui";
import { ipc, isTauri } from "../lib/ipc";
export function Settings() {
  const [sources, setSources] = useState({
    kp: true,
    halo: false,
    limundo: false,
  });
  const [mono, setMono] = useState(false);
  const [backend, setBackend] = useState<string>("proveravam…");
  const [appVersion, setAppVersion] = useState<string>("—");
  const [cookies, setCookies] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);
  const [llmProvider, setLlmProvider] = useState<string>("");
  const [llmModel, setLlmModel] = useState<string>("");
  const [llmKey, setLlmKey] = useState<string>("");

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
              {[
                { k: "kp", label: "KupujemProdajem", desc: cookies ? "Cookies uhvaćeni" : "Poveži da rešiš Cloudflare" },
                { k: "halo", label: "HaloOglasi", desc: "Sekundarni izvor" },
                { k: "limundo", label: "Limundo / Kupindo", desc: "Aukcije" },
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
                        setSources((x) => ({ ...x, [s.k]: v }))
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
              <b>LLM ekstrakcija</b>
            </div>
            <div className="card-b">
              <div style={{ marginBottom: 10 }}>
                <div className="label" style={{ marginBottom: 6 }}>Provajder</div>
                <select
                  className="select"
                  value={llmProvider}
                  onChange={(e) => setLlmProvider(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="">Heuristika (bez LLM-a)</option>
                  <option value="ollama">Ollama (lokalno)</option>
                  <option value="groq">Groq (cloud)</option>
                  <option value="gemini">Gemini (cloud)</option>
                </select>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div className="label" style={{ marginBottom: 6 }}>Model</div>
                <input
                  className="input"
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                  placeholder={llmProvider === "ollama" ? "qwen3:4b" : llmProvider === "groq" ? "llama-3.3-70b-versatile" : "gemini-2.5-flash"}
                  style={{ width: "100%" }}
                />
              </div>
              {(llmProvider === "groq" || llmProvider === "gemini") && (
                <div style={{ marginBottom: 10 }}>
                  <div className="label" style={{ marginBottom: 6 }}>API ključ</div>
                  <input
                    className="input"
                    type="password"
                    value={llmKey}
                    onChange={(e) => setLlmKey(e.target.value)}
                    placeholder="sk-…"
                    style={{ width: "100%" }}
                  />
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={async () => {
                    await ipc.setLlmConfig(llmProvider, llmModel, llmKey);
                    setToast("Sačuvano");
                    setTimeout(() => setToast(null), 2400);
                  }}
                >
                  Sačuvaj
                </Button>
                {llmProvider === "ollama" && (
                  <span className="faint mono" style={{ fontSize: 9, alignSelf: "center" }}>
                    localhost:11434
                  </span>
                )}
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
            </div>
          </div>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
