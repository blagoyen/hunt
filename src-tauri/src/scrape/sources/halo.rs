use crate::scrape::ScrapedListing;
use regex::Regex;
use scraper::{Html, Selector};
use std::collections::HashSet;

pub async fn search(
    client: &reqwest::Client,
    query: &str,
    cookies: &[(String, String, String)],
) -> Result<Vec<ScrapedListing>, String> {
    let url = format!(
        "https://www.halooglasi.com/pretraga?oglas=iphone&tekst={}",
        urlencoding::encode(query)
    );
    let mut req = client
        .get(&url)
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
        .header("Accept-Language", "sr,en;q=0.9");
    if !cookies.is_empty() {
        let ch: String = cookies.iter().map(|(n, v, _)| format!("{}={}", n, v)).collect::<Vec<_>>().join("; ");
        req = req.header("Cookie", ch);
    }
    let resp = req.send().await.map_err(|e| format!("http: {}", e))?;
    let status = resp.status();
    let body = resp.text().await.map_err(|e| format!("body: {}", e))?;
    if !status.is_success() {
        return Err(format!("status {}", status));
    }
    let _ = std::fs::write("/tmp/halo_last.html", &body);
    parse(&body)
}

fn parse(html: &str) -> Result<Vec<ScrapedListing>, String> {
    let doc = Html::parse_document(html);
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    let price_re = Regex::new(r"(\d[\d\.\s]*)(?:\s*)(€|EUR|RSD|din)").unwrap();

    let selectors = [
        "a[href*='iphone']",
        ".ad-item a",
        "article a",
        "a[href*='/oglasi/']",
    ];

    for sel_str in selectors {
        let sel = match Selector::parse(sel_str) { Ok(s) => s, Err(_) => continue };
        for el in doc.select(&sel) {
            let title = el.text().collect::<Vec<_>>().join(" ").trim().to_string();
            if title.len() < 8 { continue; }
            let href = match el.value().attr("href") { Some(h) => h.to_string(), None => continue };
            let url = if href.starts_with("http") { href.clone() } else { format!("https://www.halooglasi.com{}", href) };
            if !seen.insert(url.clone()) { continue; }
            let mut price = None;
            let location = None;
            if let Some(parent) = el.parent() {
                let pt: String = parent.descendants().filter_map(|n| n.value().as_text()).map(|t| t.text.to_string()).collect::<Vec<_>>().join(" ");
                if let Some(caps) = price_re.captures(&pt) {
                    let num_str = caps.get(1).unwrap().as_str().replace(['.', ' '], "");
                    if let Ok(n) = num_str.parse::<f64>() {
                        let unit = caps.get(2).unwrap().as_str();
                        price = Some(if unit == "RSD" || unit == "din" { n / 117.0 } else { n });
                    }
                }
            }
            let external_id = url.split('/').last().unwrap_or("unknown").to_string();
            out.push(ScrapedListing {
                source: "halo".to_string(),
                external_id,
                url,
                title,
                price,
                location,
                seller: None,
                description: None,
                image_urls: vec![],
            });
            if out.len() >= 60 { break; }
        }
        if !out.is_empty() { break; }
    }
    Ok(out)
}
