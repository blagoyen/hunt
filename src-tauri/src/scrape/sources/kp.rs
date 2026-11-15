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
        "https://www.kupujemprodajem.com/search.php?keywords={}",
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
    let _ = std::fs::write("/tmp/kp_search.html", &body);
    parse_search(&body)
}

fn parse_search(html: &str) -> Result<Vec<ScrapedListing>, String> {
    let doc = Html::parse_document(html);
    let mut out = Vec::new();
    let mut seen = HashSet::new();
    let price_re = Regex::new(r"(\d[\d\.\s]*)(?:\s*)(€|EUR|RSD|din)").unwrap();

    let selectors = [
        "a[href*='/prodajem-']",
        "a.kp-ad",
        ".ad a",
        "article a",
    ];

    for sel_str in selectors {
        let sel = match Selector::parse(sel_str) {
            Ok(s) => s,
            Err(_) => continue,
        };
        for el in doc.select(&sel) {
            let title = el.text().collect::<Vec<_>>().join(" ").trim().to_string();
            if title.len() < 6 {
                continue;
            }
            let href = match el.value().attr("href") {
                Some(h) => h.to_string(),
                None => continue,
            };
            // Only "prodajem" (for sale) listings
            if !href.contains("/prodajem-") && !href.contains("prodajem") {
                continue;
            }
            if href.contains("/kupujem-") {
                continue;
            }
            let title_l = title.to_lowercase();
            if title_l.trim_start().starts_with("kupujem") || title_l.trim_start().starts_with("trazim") || title_l.trim_start().starts_with("tražim") {
                continue;
            }
            let url = if href.starts_with("http") {
                href.clone()
            } else {
                format!("https://www.kupujemprodajem.com{}", href)
            };
            if !seen.insert(url.clone()) {
                continue;
            }
            let mut price = None;
            let mut location = None;
            if let Some(parent) = el.parent() {
                let pt: String = parent
                    .descendants()
                    .filter_map(|n| n.value().as_text())
                    .map(|t| t.text.to_string())
                    .collect::<Vec<_>>()
                    .join(" ");
                if let Some(caps) = price_re.captures(&pt) {
                    let num_str = caps.get(1).unwrap().as_str().replace(['.', ' '], "");
                    if let Ok(n) = num_str.parse::<f64>() {
                        let unit = caps.get(2).unwrap().as_str();
                        price = Some(if unit == "RSD" || unit == "din" {
                            n / 117.0
                        } else {
                            n
                        });
                    }
                }
            }
            let external_id = url.split('/').last().unwrap_or("unknown").to_string();
            out.push(ScrapedListing {
                source: "kp".to_string(),
                external_id,
                url,
                title,
                price,
                location,
                seller: None,
                description: None,
                image_urls: vec![],
            });
            if out.len() >= 40 {
                break;
            }
        }
        if !out.is_empty() {
            break;
        }
    }

    if out.is_empty() {
        let a_sel = Selector::parse("a").unwrap();
        for el in doc.select(&a_sel) {
            let href = el.value().attr("href").unwrap_or("");
            if !href.contains("prodajem") || href.contains("kupujem") {
                continue;
            }
            let title = el.text().collect::<Vec<_>>().join(" ").trim().to_string();
            if title.len() < 8 {
                continue;
            }
            let url = if href.starts_with("http") {
                href.to_string()
            } else {
                format!("https://www.kupujemprodajem.com{}", href)
            };
            if !seen.insert(url.clone()) {
                continue;
            }
            out.push(ScrapedListing {
                source: "kp".to_string(),
                external_id: url.clone(),
                url,
                title,
                price: None,
                location: None,
                seller: None,
                description: None,
                image_urls: vec![],
            });
            if out.len() >= 40 {
                break;
            }
        }
    }

    Ok(out)
}

/// Fetch a single listing's detail page: description + image URLs.
pub async fn fetch_detail(
    client: &reqwest::Client,
    url: &str,
    cookies: &[(String, String, String)],
) -> Result<ScrapedListing, String> {
    let mut req = client
        .get(url)
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
    let _ = std::fs::write("/tmp/kp_detail.html", &body);

    let doc = Html::parse_document(&body);

    // Title
    let title_sel = Selector::parse("h1").unwrap();
    let title = doc
        .select(&title_sel)
        .next()
        .map(|e| e.text().collect::<Vec<_>>().join(" ").trim().to_string())
        .unwrap_or_default();

    // Description
    let desc_sel_candidates = ["div.description", ".ad-description", "div.kp-desc", "article", "div.content"];
    let mut description = None;
    for sel_str in desc_sel_candidates {
        if let Ok(sel) = Selector::parse(sel_str) {
            if let Some(el) = doc.select(&sel).next() {
                let t = el.text().collect::<Vec<_>>().join(" ").trim().to_string();
                if t.len() > 20 {
                    description = Some(t);
                    break;
                }
            }
        }
    }

    // Images: collect all img src that look like photos
    let mut image_urls = Vec::new();
    let img_sel = Selector::parse("img").unwrap();
    for el in doc.select(&img_sel) {
        if let Some(src) = el.value().attr("src").or_else(|| el.value().attr("data-src")) {
            let s = src.to_string();
            if s.starts_with("http") && (s.contains(".jpg") || s.contains(".jpeg") || s.contains(".png") || s.contains(".webp") || s.contains("image")) {
                if !image_urls.contains(&s) {
                    image_urls.push(s);
                }
            }
        }
        if image_urls.len() >= 8 {
            break;
        }
    }

    // Price
    let price_re = Regex::new(r"(\d[\d\.\s]*)(?:\s*)(€|EUR|RSD|din)").unwrap();
    let full_text: String = doc.root_element().text().collect::<Vec<_>>().join(" ");
    let price = price_re.captures(&full_text).and_then(|caps| {
        let num_str = caps.get(1).unwrap().as_str().replace(['.', ' '], "");
        let n: f64 = num_str.parse().ok()?;
        let unit = caps.get(2).unwrap().as_str();
        Some(if unit == "RSD" || unit == "din" { n / 117.0 } else { n })
    });

    // Location
    let location = None;

    let external_id = url.split('/').last().unwrap_or("unknown").to_string();

    Ok(ScrapedListing {
        source: "kp".to_string(),
        external_id,
        url: url.to_string(),
        title: if title.is_empty() { "KP oglas".to_string() } else { title },
        price,
        location,
        seller: None,
        description,
        image_urls,
    })
}
