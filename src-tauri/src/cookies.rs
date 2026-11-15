use std::sync::Mutex;

pub struct CookieJar {
    pub cookies: Mutex<Vec<(String, String, String)>>, // (name, value, domain)
}

impl CookieJar {
    pub fn new() -> Self {
        Self { cookies: Mutex::new(Vec::new()) }
    }
    pub fn set(&self, cookies: Vec<(String, String, String)>) {
        *self.cookies.lock().unwrap() = cookies;
    }
    pub fn get(&self) -> Vec<(String, String, String)> {
        self.cookies.lock().unwrap().clone()
    }
    pub fn has(&self) -> bool {
        !self.cookies.lock().unwrap().is_empty()
    }
}
