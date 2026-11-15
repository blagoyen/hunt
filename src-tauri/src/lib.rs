mod config;
mod cookies;
mod db;
mod extract;
mod ipc;
mod profit;
mod scrape;

use cookies::CookieJar;
use db::Db;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let data_dir = dirs::data_dir()
                .unwrap_or_else(|| std::path::PathBuf::from("."))
                .join("hunt");
            let _ = std::fs::create_dir_all(&data_dir);
            let db_path = data_dir.join("hunt.db");
            let db = Db::open(db_path).expect("failed to open db");
            app.manage(db);
            app.manage(CookieJar::new());

            // System tray
            let show_item = MenuItem::with_id(app, "show", "Prikaži", true, None::<&str>).unwrap();
            let quit_item = MenuItem::with_id(app, "quit", "Izađi", true, None::<&str>).unwrap();
            let menu = Menu::with_items(app, &[&show_item, &quit_item]).unwrap();
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)
                .unwrap();

            Ok(())
        })
        .on_window_event(|window, event| {
            // Minimize to tray instead of closing
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            ipc::list_listings,
            ipc::calc_profit,
            ipc::greet,
            ipc::scrape_source,
            ipc::connect_source,
            ipc::capture_cookies,
            ipc::cookies_status,
            ipc::extract_listing,
            ipc::extract_all,
            ipc::get_llm_config,
            ipc::set_llm_config,
            ipc::get_hunt_profile,
            ipc::set_hunt_profile,
            ipc::test_llm,
            ipc::clear_listings,
            ipc::save_manual_listing,
            ipc::list_parts_prices,
            ipc::upsert_part_price,
            ipc::delete_part_price,
            ipc::list_devices,
            ipc::upsert_device,
            ipc::delete_device,
            ipc::open_external_url,
            ipc::lookup_imei,
            ipc::get_budget,
            ipc::set_budget,
            ipc::revert_device_status,
            ipc::save_export_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
