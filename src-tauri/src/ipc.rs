use crate::config::LlmConfig;
use crate::db::Db;
use crate::profit::{profit, DealInput, DealOutput};
use crate::scrape;
use serde::Serialize;
use tauri::State;

#[derive(Serialize)]
pub struct ListingRow {
    pub id: i64,
    pub source: String,
    pub title: String,
    pub price: f64,
    pub location: Option<String>,
    pub seller: Option<String>,
    pub status: String,
}

#[tauri::command]
pub fn list_listings(db: State<'_, Db>) -> Result<Vec<serde_json::Value>, String> {
    db.list_listings().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn calc_profit(input: DealInput) -> DealOutput {
    profit(&input)
}

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Zdravo, {}!", name)
}

fn is_wanted_buy(text: &str) -> bool {
    let t = text.to_lowercase();
    let tt = t.trim();
    tt.starts_with("kupujem") || tt.starts_with("kupim") || tt.starts_with("trazim") || tt.starts_with("tražim")
        || t.contains("kupujem iphone") || t.contains("kupim iphone") || t.contains("otkup iphone")
        || t.contains("potreban iphone") || t.contains("potreban mi iphone") || t.contains("trazim iphone") || t.contains("tražim iphone")
}

fn matches_hunt_profile(detail: &scrape::ScrapedListing, profile: &crate::config::HuntProfile) -> bool {
    let url_l = detail.url.to_lowercase();
    let title_l = detail.title.to_lowercase();
    let desc_l = detail.description.as_deref().unwrap_or("").to_lowercase();
    let hay = format!("{} {} {}", url_l, title_l, desc_l);

    if profile.only_for_sale {
        if url_l.contains("/kupujem") || is_wanted_buy(&detail.title) { return false; }
        if !url_l.contains("prodajem") && !url_l.is_empty() { return false; }
    }
    if !hay.contains("iphone") { return false; }

    // price guard (if known)
    if let Some(p) = detail.price {
        if profile.min_price > 0.0 && p < profile.min_price { return false; }
        if profile.max_price > 0.0 && p > profile.max_price { return false; }
    }

    // target models (if configured, require one to match)
    if !profile.target_models.is_empty() {
        let ok = profile.target_models.iter().any(|m| hay.contains(&m.to_lowercase()));
        if !ok { return false; }
    }

    // hard exclude terms
    for term in &profile.exclude_terms {
        let tl = term.to_lowercase();
        if !tl.is_empty() && hay.contains(&tl) { return false; }
    }

    // obvious iCloud locked
    if profile.exclude_icloud_locked && hay.contains("icloud") && (hay.contains("zakljuc") || hay.contains("zaključ") || hay.contains("locked")) {
        return false;
    }

    true
}

#[tauri::command]
pub async fn scrape_source(
    db: State<'_, Db>,
    cookies: State<'_, crate::cookies::CookieJar>,
    source: String,
    query: String,
) -> Result<serde_json::Value, String> {
    let app_cfg = crate::config::AppConfig::load();
    let profile = app_cfg.hunt_profile.clone();
    let llm_cfg = app_cfg.llm.clone();
    let cs = cookies.get();
    let client = scrape::http::build_client();

    // Build search queries: for KP use profile search terms if query is generic
    let queries: Vec<String> = if source == "kp" && (query.trim().is_empty() || query.trim().eq_ignore_ascii_case("iphone")) && !profile.search_terms.is_empty() {
        profile.search_terms.clone()
    } else {
        vec![if query.trim().is_empty() { "iphone".to_string() } else { query }]
    };

    let mut stubs: Vec<scrape::ScrapedListing> = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for q in &queries {
        let res = match source.as_str() {
            "kp" => scrape::sources::kp::search(&client, q, &cs).await?,
            "halo" => scrape::sources::halo::search(&client, q, &cs).await?,
            "limundo" => scrape::sources::limundo::search(&client, q, &cs).await?,
            _ => return Err("unknown source".to_string()),
        };
        for s in res {
            if seen.insert(s.url.clone()) { stubs.push(s); }
        }
    }

    let mut found = stubs.len();
    let mut passed = 0usize;
    let mut saved = 0usize;
    let max = if profile.max_results == 0 { 20 } else { profile.max_results };

    for stub in stubs {
        if saved >= max { break; }

        // Early filter on stub (title/url/price) for KP
        if source == "kp" {
            let url_l = stub.url.to_lowercase();
            if profile.only_for_sale && (url_l.contains("/kupujem") || !url_l.contains("prodajem")) { continue; }
            if is_wanted_buy(&stub.title) { continue; }
            let hay = format!("{} {}", stub.title.to_lowercase(), url_l);
            if !hay.contains("iphone") { continue; }
            if let Some(p) = stub.price {
                if profile.min_price > 0.0 && p < profile.min_price { continue; }
                if profile.max_price > 0.0 && p > profile.max_price { continue; }
            }
            // quick exclude terms on title
            let t_l = stub.title.to_lowercase();
            if profile.exclude_terms.iter().any(|term| { let tl = term.to_lowercase(); !tl.is_empty() && t_l.contains(&tl) }) { continue; }
        }

        let detail = if source == "kp" {
            scrape::sources::kp::fetch_detail(&client, &stub.url, &cs).await.unwrap_or(stub)
        } else { stub };

        // Full profile filter on detail
        if source == "kp" && !matches_hunt_profile(&detail, &profile) { continue; }
        passed += 1;

        if let Ok(id) = db.upsert_listing(&detail) {
            let img_dir = dirs::data_dir().unwrap_or_default().join("hunt").join("images").join(id.to_string());
            let _ = std::fs::create_dir_all(&img_dir);
            let mut local_paths = Vec::new();
            for (i, url) in detail.image_urls.iter().take(6).enumerate() {
                let path = img_dir.join(format!("{}.jpg", i));
                if let Ok(resp) = client.get(url).send().await {
                    if let Ok(bytes) = resp.bytes().await {
                        let _ = std::fs::write(&path, &bytes);
                        local_paths.push(path.to_string_lossy().to_string());
                        let conn = db.conn.lock().unwrap();
                        let _ = conn.execute(
                            "INSERT INTO listing_images (listing_id, url, local_path) VALUES (?1, ?2, ?3)",
                            rusqlite::params![id, url, path.to_string_lossy().to_string()],
                        );
                    }
                }
            }
            let attrs = crate::extract::extract(&detail.title, detail.description.as_deref().unwrap_or(""), &local_paths, &llm_cfg).await;
            // If AI/heuristics indicate locked iCloud and profile excludes it, skip saving as relevant? we still saved listing; mark via attrs not possible without schema change - keep it but hard filter already applied.
            let _ = db.upsert_attrs(id, &attrs);
            saved += 1;
        }
    }

    Ok(serde_json::json!({ "saved": saved, "passed": passed, "found": found }))
}

#[tauri::command]
pub async fn connect_source(app: tauri::AppHandle, source: String) -> Result<(), String> {
    use tauri::Manager;
    let url = match source.as_str() {
        "kp" => "https://www.kupujemprodajem.com/",
        "halo" => "https://www.halooglasi.com/",
        "limundo" => "https://www.limundo.com/",
        _ => return Err("unknown source".to_string()),
    };
    let label = format!("connect-{}", source);
    // Close existing if any
    if let Some(w) = app.get_webview_window(&label) {
        let _ = w.close();
    }
    let _window = tauri::WebviewWindowBuilder::new(&app, &label, tauri::WebviewUrl::External(url.parse().unwrap()))
        .title(format!("Poveži {}", source.to_uppercase()))
        .inner_size(1100.0, 760.0)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn capture_cookies(
    app: tauri::AppHandle,
    cookies: State<'_, crate::cookies::CookieJar>,
    source: String,
) -> Result<usize, String> {
    use tauri::Manager;
    let label = format!("connect-{}", source);
    let window = app
        .get_webview_window(&label)
        .ok_or_else(|| "prozor nije otvoren".to_string())?;
    // Read cookies for the source domain
    let all = window.cookies().map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for c in all {
        out.push((c.name().to_string(), c.value().to_string(), c.domain().unwrap_or("").to_string()));
    }
    let n = out.len();
    cookies.set(out);
    // Close the window
    let _ = window.close();
    Ok(n)
}

#[tauri::command]
pub fn cookies_status(cookies: State<'_, crate::cookies::CookieJar>) -> bool {
    cookies.has()
}

#[tauri::command]
pub fn get_llm_config() -> LlmConfig {
    LlmConfig::load()
}

#[tauri::command]
pub fn set_llm_config(provider: String, model: String, api_key: String, base_url: String) -> Result<(), String> {
    let new_cfg = LlmConfig { provider, model, api_key, base_url };
    new_cfg.save()
}

#[tauri::command]
pub fn get_hunt_profile() -> crate::config::HuntProfile {
    crate::config::AppConfig::load().hunt_profile
}

#[tauri::command]
pub fn set_hunt_profile(profile: crate::config::HuntProfile) -> Result<(), String> {
    let mut app = crate::config::AppConfig::load();
    app.hunt_profile = profile;
    app.save()
}

#[tauri::command]
pub async fn test_llm(prompt: String) -> Result<String, String> {
    let cfg = LlmConfig::load();
    if cfg.provider.is_empty() {
        return Err("Nije izabran AI provajder. Sačuvaj podešavanja prvo.".to_string());
    }
    crate::extract::llm::test_llm_prompt(&prompt, &cfg).await
}

#[tauri::command]
pub fn clear_listings(db: State<'_, Db>) -> Result<usize, String> {
    let n = db.clear_listings().map_err(|e| e.to_string())?;
    // Remove downloaded images folder
    let img_dir = dirs::data_dir().unwrap_or_default().join("hunt").join("images");
    let _ = std::fs::remove_dir_all(&img_dir);
    Ok(n)
}

#[tauri::command]
pub fn save_manual_listing(db: State<'_, Db>, data: serde_json::Value) -> Result<i64, String> {
    db.save_manual_listing(&data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_parts_prices(db: State<'_, Db>) -> Result<Vec<serde_json::Value>, String> {
    db.list_parts_prices().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn upsert_part_price(db: State<'_, Db>, item: serde_json::Value) -> Result<(), String> {
    db.upsert_part_price(&item).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_part_price(db: State<'_, Db>, model: String, part: String, quality: String) -> Result<(), String> {
    db.delete_part_price(&model, &part, &quality).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_devices(db: State<'_, Db>) -> Result<Vec<serde_json::Value>, String> {
    db.list_devices().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn upsert_device(db: State<'_, Db>, data: serde_json::Value) -> Result<i64, String> {
    db.upsert_device(&data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_device(db: State<'_, Db>, id: i64) -> Result<(), String> {
    db.delete_device(id).map_err(|e| e.to_string())
}


#[tauri::command]
pub fn get_budget(db: State<'_, Db>) -> Result<serde_json::Value, String> {
    let total: f64 = db.get_setting("budget_total_eur").map_err(|e| e.to_string())?
        .and_then(|v| v.parse::<f64>().ok()).unwrap_or(0.0);
    Ok(serde_json::json!({ "total_eur": total }))
}

#[tauri::command]
pub fn set_budget(db: State<'_, Db>, total_eur: f64) -> Result<(), String> {
    db.set_setting("budget_total_eur", &format!("{}", if total_eur < 0.0 { 0.0 } else { total_eur })).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn revert_device_status(db: State<'_, Db>, id: i64) -> Result<serde_json::Value, String> {
    let prev = db.revert_device_status(id).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "previous_status": prev }))
}

#[tauri::command]
pub fn open_external_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn lookup_imei(imei: String) -> Result<serde_json::Value, String> {
    let cleaned: String = imei.chars().filter(|c| c.is_ascii_alphanumeric()).collect();
    if cleaned.is_empty() {
        return Err("IMEI/serijski broj je prazan".to_string());
    }

    fn guess_model_from_tac(tac: &str) -> Option<String> {
        // Common iPhone TAC prefixes (best-effort fallback when online lookup is limited)
        let map: &[(&str,&str)] = &[
            ("35391510","iPhone 11"),("35391511","iPhone 11"),("35656210","iPhone 11 Pro"),("35656211","iPhone 11 Pro"),
            ("35672010","iPhone 12"),("35672110","iPhone 12 mini"),("35672210","iPhone 12 Pro"),("35672310","iPhone 12 Pro Max"),
            ("35672011","iPhone 12"),("35699410","iPhone 13"),("35699510","iPhone 13 mini"),("35699610","iPhone 13 Pro"),("35699710","iPhone 13 Pro Max"),
            ("35327610","iPhone 13"),("35391811","iPhone 14"),("35391911","iPhone 14 Plus"),("35392011","iPhone 14 Pro"),("35392111","iPhone 14 Pro Max"),
            ("35866110","iPhone 15"),("35866210","iPhone 15 Plus"),("35866310","iPhone 15 Pro"),("35866410","iPhone 15 Pro Max"),
            ("35945910","iPhone 16"),("35946010","iPhone 16 Plus"),("35946110","iPhone 16 Pro"),("35946210","iPhone 16 Pro Max"),
            ("35640510","iPhone SE (2nd)"),("35867910","iPhone SE (3rd)"),("35284011","iPhone XR"),("35304511","iPhone XS"),("35304611","iPhone XS Max"),
            ("35305210","iPhone X"),("35669610","iPhone 8"),("35669710","iPhone 8 Plus"),
        ];
        for (p, name) in map { if tac.starts_with(p) { return Some((*name).to_string()); } }
        None
    }
    fn parse_storage_gb(s: &str) -> Option<i64> {
        let low = s.to_lowercase();
        let num: String = low.chars().filter(|c| c.is_ascii_digit()).collect();
        let n = num.parse::<i64>().ok()?;
        if low.contains("tb") { return Some(n * 1024); }
        if n > 0 { return Some(n); }
        None
    }
    fn pick_str(v: &serde_json::Value, keys: &[&str]) -> Option<String> {
        for k in keys {
            if let Some(s) = v.get(*k).and_then(|x| x.as_str()) {
                let t = s.trim();
                if !t.is_empty() { return Some(t.to_string()); }
            }
        }
        None
    }
    fn find_str_deep(v: &serde_json::Value, key: &str) -> Option<String> {
        match v {
            serde_json::Value::Object(map) => {
                if let Some(s) = map.get(key).and_then(|x| x.as_str()) { let t = s.trim(); if !t.is_empty() { return Some(t.to_string()); } }
                for (_, vv) in map { if let Some(r) = find_str_deep(vv, key) { return Some(r); } }
                None
            }
            serde_json::Value::Array(arr) => { for vv in arr { if let Some(r) = find_str_deep(vv, key) { return Some(r); } } None }
            _ => None,
        }
    }

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;

    let mut out = serde_json::json!({
        "ok": false,
        "input": cleaned,
        "source": "applesn",
        "model": serde_json::Value::Null,
        "storage_gb": serde_json::Value::Null,
        "color": serde_json::Value::Null,
        "message": "",
    });
    let tac = if cleaned.len() >= 8 { cleaned[0..8].to_string() } else { "".to_string() };
    if !tac.is_empty() { out["tac"] = serde_json::json!(tac); }

    // 1) Try AppleSN API
    let payload = serde_json::json!({ "imei": cleaned, "locale": "en" });
    let resp_res = client
        .post("https://applesn.info/api/check")
        .header("content-type", "application/json")
        .header("origin", "https://applesn.info")
        .header("referer", "https://applesn.info/sn-result/")
        .json(&payload)
        .send()
        .await;
    if let Ok(resp) = resp_res {
        let status = resp.status().as_u16();
        if let Ok(body) = resp.json::<serde_json::Value>().await {
            out["status"] = serde_json::json!(status);
            out["raw"] = body.clone();
            if let Some(parts) = body.get("imeiParts") { out["imeiParts"] = parts.clone(); }
            if let Some(outcome) = body.get("outcome").and_then(|v| v.as_str()) { out["outcome"] = serde_json::json!(outcome); }
            let device = body.get("device").cloned().unwrap_or(serde_json::Value::Null);
            let model = pick_str(&device, &["modelName", "model", "name", "product", "marketingName", "deviceName"])
                .or_else(|| pick_str(&body, &["modelName", "model", "name", "product", "marketingName"]))
                .or_else(|| find_str_deep(&body, "modelName"))
                .or_else(|| find_str_deep(&body, "marketingName"));
            let storage_str = pick_str(&device, &["capacity", "storage", "memory", "size"])
                .or_else(|| pick_str(&body, &["capacity", "storage", "memory"]))
                .or_else(|| find_str_deep(&body, "capacity"))
                .or_else(|| find_str_deep(&body, "storage"));
            let color = pick_str(&device, &["color", "colour"])
                .or_else(|| pick_str(&body, &["color", "colour"]))
                .or_else(|| find_str_deep(&body, "color"));
            if let Some(m) = model.clone() { out["model"] = serde_json::json!(m); }
            if let Some(c) = color.clone() { out["color"] = serde_json::json!(c); }
            if let Some(sv) = storage_str.as_ref().and_then(|x| parse_storage_gb(x)) { out["storage_gb"] = serde_json::json!(sv); }
        }
    }

    // 2) Fallback: TAC-based model guess if still missing model
    let has_model = out.get("model").and_then(|v| v.as_str()).map(|s| !s.trim().is_empty()).unwrap_or(false);
    if !has_model {
        if let Some(g) = guess_model_from_tac(&tac) {
            out["model"] = serde_json::json!(g);
            out["source"] = serde_json::json!("tac_guess");
        }
    }

    let has_data = out.get("model").and_then(|v| v.as_str()).map(|s| !s.trim().is_empty()).unwrap_or(false)
        || out.get("storage_gb").and_then(|v| v.as_i64()).is_some()
        || out.get("color").and_then(|v| v.as_str()).map(|s| !s.trim().is_empty()).unwrap_or(false);
    if has_data {
        out["ok"] = serde_json::json!(true);
        let src = out.get("source").and_then(|v| v.as_str()).unwrap_or("applesn");
        out["message"] = serde_json::json!(if src == "tac_guess" { "IMEI normalizovan i model procenjen na osnovu TAC prefiksa (automatski)." } else { "Podaci preuzeti automatski (AppleSN)." });
    } else {
        let msg = match out.get("outcome").and_then(|v| v.as_str()) {
            Some("captcha_rejected") => "AppleSN zahteva captcha; IMEI je normalizovan, a model nije mogao biti automatski prepoznat.",
            Some(other) => &format!("AppleSN: {}. IMEI normalizovan.", other),
            None => "Automatska provera nije vratila model; IMEI je normalizovan.",
        };
        out["message"] = serde_json::json!(msg);
    }
    Ok(out)
}


#[tauri::command]
pub fn save_export_file(filename: String, contents: String) -> Result<String, String> {
    let safe_name = filename
        .chars()
        .map(|c| if matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') { '_' } else { c })
        .collect::<String>();
    if safe_name.trim().is_empty() {
        return Err("nedostaje ime fajla".to_string());
    }
    let mut dir = dirs::download_dir().unwrap_or_else(|| dirs::data_dir().unwrap_or_else(|| std::path::PathBuf::from(".")).join("hunt").join("exports"));
    if dir.as_os_str().is_empty() {
        dir = std::path::PathBuf::from(".");
    }
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(safe_name);
    std::fs::write(&path, contents).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn extract_listing(db: State<'_, Db>, id: i64) -> Result<(), String> {
    let (title, image_paths) = {
        let conn = db.conn.lock().unwrap();
        let title: String = conn.query_row("SELECT title FROM listings WHERE id = ?1", rusqlite::params![id], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare("SELECT local_path FROM listing_images WHERE listing_id = ?1").map_err(|e| e.to_string())?;
        let rows = stmt.query_map(rusqlite::params![id], |r| r.get::<_, String>(0)).map_err(|e| e.to_string())?;
        let mut paths = Vec::new();
        for r in rows {
            if let Ok(p) = r { paths.push(p); }
        }
        (title, paths)
    };
    let cfg = crate::config::LlmConfig::load();
    let attrs = crate::extract::extract(&title, "", &image_paths, &cfg).await;
    db.upsert_attrs(id, &attrs).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn extract_all(db: State<'_, Db>) -> Result<usize, String> {
    let items: Vec<(i64, String, Vec<String>)> = {
        let conn = db.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, title FROM listings").map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?))).map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for r in rows {
            if let Ok((id, title)) = r {
                let mut img_stmt = conn.prepare("SELECT local_path FROM listing_images WHERE listing_id = ?1").unwrap();
                let img_rows = img_stmt.query_map(rusqlite::params![id], |r| r.get::<_, String>(0)).unwrap();
                let mut paths = Vec::new();
                for ir in img_rows {
                    if let Ok(p) = ir { paths.push(p); }
                }
                out.push((id, title, paths));
            }
        }
        out
    };
    let cfg = crate::config::LlmConfig::load();
    let mut count = 0;
    for (id, title, paths) in items {
        let attrs = crate::extract::extract(&title, "", &paths, &cfg).await;
        if db.upsert_attrs(id, &attrs).is_ok() {
            count += 1;
        }
    }
    Ok(count)
}
