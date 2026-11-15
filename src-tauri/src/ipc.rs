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

#[tauri::command]
pub async fn scrape_source(
    db: State<'_, Db>,
    cookies: State<'_, crate::cookies::CookieJar>,
    source: String,
    query: String,
) -> Result<usize, String> {
    let cs = cookies.get();
    let client = scrape::http::build_client();
    let stubs = match source.as_str() {
        "kp" => scrape::sources::kp::search(&client, &query, &cs).await?,
        "halo" => scrape::sources::halo::search(&client, &query, &cs).await?,
        "limundo" => scrape::sources::limundo::search(&client, &query, &cs).await?,
        _ => return Err("unknown source".to_string()),
    };
    let mut count = 0;
    for stub in stubs {
        // Fetch detail page for description + images (KP only for now)
        let detail = if source == "kp" {
            scrape::sources::kp::fetch_detail(&client, &stub.url, &cs).await.unwrap_or(stub)
        } else {
            stub
        };

        // For KP: keep only iPhone listings for sale (no "kupujem"/wanted-to-buy ads)
        if source == "kp" {
            let title_l = detail.title.to_lowercase();
            let desc_l = detail.description.as_deref().unwrap_or("").to_lowercase();
            let hay = format!("{} {}", title_l, desc_l);

            if !hay.contains("iphone") {
                continue;
            }

            let t = title_l.trim();
            let is_wanted = t.starts_with("kupujem")
                || t.starts_with("trazim")
                || t.starts_with("tražim")
                || t.contains("kupujem iphone")
                || t.contains("kupujem ajfon")
                || t.contains("tražim iphone")
                || t.contains("trazim iphone")
                || t.contains("potreban iphone")
                || t.contains("potreban mi iphone");
            if is_wanted {
                continue;
            }
        }

        if let Ok(id) = db.upsert_listing(&detail) {
            count += 1;
            // Download images first
            let img_dir = dirs::data_dir().unwrap_or_default().join("hunt").join("images").join(id.to_string());
            let _ = std::fs::create_dir_all(&img_dir);
            let mut local_paths = Vec::new();
            for (i, url) in detail.image_urls.iter().enumerate() {
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
            // Run extraction with images
            let cfg = crate::config::LlmConfig::load();
            let attrs = crate::extract::extract(&detail.title, detail.description.as_deref().unwrap_or(""), &local_paths, &cfg).await;
            let _ = db.upsert_attrs(id, &attrs);
        }
    }
    Ok(count)
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
pub fn set_llm_config(provider: String, model: String, api_key: String) -> Result<(), String> {
    let new_cfg = LlmConfig { provider, model, api_key };
    new_cfg.save()
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
