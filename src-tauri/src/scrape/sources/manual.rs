pub async fn search(
    client: &reqwest::Client,
    query: &str,
    _cookies: &[(String, String, String)],
) -> Result<Vec<crate::scrape::ScrapedListing>, String> {
    let _ = (client, query);
    Ok(vec![])
}
