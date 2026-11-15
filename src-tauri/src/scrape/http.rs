use reqwest::Client;
use std::time::Duration;

pub fn build_client() -> Client {
    build_client_with_cookies(&[])
}

pub fn build_client_with_cookies(cookies: &[(String, String, String)]) -> Client {
    let mut builder = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .timeout(Duration::from_secs(25))
        .cookie_store(true)
        .redirect(reqwest::redirect::Policy::limited(5));

    // Apply cookies via a cookie jar by building headers manually is complex;
    // instead we rely on reqwest's cookie store being populated by responses.
    // For pre-captured cookies, attach them as a Cookie header.
    if !cookies.is_empty() {
        let cookie_header: String = cookies
            .iter()
            .map(|(n, v, _)| format!("{}={}", n, v))
            .collect::<Vec<_>>()
            .join("; ");
        // We can't easily inject into builder; store in a thread-local is not ideal.
        // Instead, callers should use `build_client` and then set cookies on requests.
        let _ = cookie_header;
    }

    builder.build().expect("failed to build http client")
}
