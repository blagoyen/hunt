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
pub fn open_external_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
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
