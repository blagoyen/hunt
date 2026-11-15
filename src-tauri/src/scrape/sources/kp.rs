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
        let cookie_header: String = cookies
            .iter()
            .map(|(n, v, _)| format!("{}={}", n, v))
            .collect::<Vec<_>>()
            .join("; ");
        req = req.header("Cookie", cookie_header);
    }
    let resp = req.send().await.map_err(|e| format!("http error: {}", e))?;

    let status = resp.status();
    let body = resp.text().await.map_err(|e| format!("read body: {}", e))?;

    if !status.is_success() {
        return Err(format!("http status {}", status));
    }

    // Save raw for debugging
    let _ = std::fs::write("/tmp/kp_last.html", &body);

    parse_list(&body, query)
}

fn parse_list(html: &str, _query: &str) -> Result<Vec<ScrapedListing>, String> {
    let doc = Html::parse_document(html);
    let mut out = Vec::new();
    let mut seen = HashSet::new();

    // Candidate link selectors
    let selectors = [
        "a[href*='/prodajem-']",
        "a[href*='/kupujem-']",
        "a.kp-ad",
        ".ad a",
        "article a",
    ];

    let price_re = Regex::new(r"(\d[\d\.\s]*)(?:\s*)(€|EUR|RSD|din)").unwrap();

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
            let url = if href.starts_with("http") {
                href.clone()
            } else {
                format!("https://www.kupujemprodajem.com{}", href)
            };
            if !seen.insert(url.clone()) {
                continue;
            }
            // price: search nearby text
            let mut price = None;
            let mut location = None;
            if let Some(parent) = el.parent() {
                let parent_text: String = parent
                    .descendants()
                    .filter_map(|n| n.value().as_text())
                    .map(|t| t.text.to_string())
                    .collect::<Vec<_>>()
                    .join(" ");
                if let Some(caps) = price_re.captures(&parent_text) {
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
            let external_id = url
                .split('/')
                .last()
                .unwrap_or("unknown")
                .to_string();
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
            if out.len() >= 60 {
                break;
            }
        }
        if !out.is_empty() {
            break;
        }
    }

    if out.is_empty() {
        // Fallback: any anchor with prodajem
        let a_sel = Selector::parse("a").unwrap();
        for el in doc.select(&a_sel) {
            let href = el.value().attr("href").unwrap_or("");
            if !href.contains("prodajem") && !href.contains("kupujem") {
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
            if out.len() >= 60 {
                break;
            }
        }
    }

    Ok(out)
}
