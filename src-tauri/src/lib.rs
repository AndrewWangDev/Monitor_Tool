use serde::Serialize;
use std::sync::{Arc, Condvar, Mutex};
use sysinfo::{CpuRefreshKind, MemoryRefreshKind, Networks, RefreshKind, System};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Emitter, Manager, State};
use tauri_plugin_window_state::{Builder as WindowStateBuilder, StateFlags};

#[derive(Serialize, Clone, Default)]
pub struct SystemMetrics {
    pub cpu_usage: f32,
    pub total_memory: u64,
    pub used_memory: u64,
    pub total_rx: u64,
    pub total_tx: u64,
    pub rx_speed: u64,
    pub tx_speed: u64,
    pub battery_available: bool,
    pub battery_level: u8,
    pub is_charging: bool,
}

pub struct AppState {
    pub system: Mutex<System>,
    pub networks: Mutex<Networks>,
    pub latest_metrics: Mutex<SystemMetrics>,
    pub wakeup: Arc<(Mutex<bool>, Condvar)>,
}

pub struct TrayMenuState {
    pub show_item: MenuItem<tauri::Wry>,
    pub quit_item: MenuItem<tauri::Wry>,
}

#[cfg(windows)]
#[allow(non_snake_case, non_camel_case_types)]
#[repr(C)]
struct SYSTEM_POWER_STATUS {
    ac_line_status: u8,
    battery_flag: u8,
    battery_life_percent: u8,
    system_status_flag: u8,
    battery_life_time: u32,
    battery_full_life_time: u32,
}

#[cfg(windows)]
extern "system" {
    #[allow(non_snake_case)]
    fn GetSystemPowerStatus(lpSystemPowerStatus: *mut SYSTEM_POWER_STATUS) -> i32;
}

#[cfg(windows)]
fn get_native_battery_status() -> (bool, u8, bool) {
    let mut status = SYSTEM_POWER_STATUS {
        ac_line_status: 255,
        battery_flag: 255,
        battery_life_percent: 255,
        system_status_flag: 0,
        battery_life_time: 0,
        battery_full_life_time: 0,
    };
    if unsafe { GetSystemPowerStatus(&mut status) } != 0 {
        // 128 indicates no system battery installed (desktop PC)
        // 255 indicates unknown battery status
        if status.battery_flag != 128
            && status.battery_flag != 255
            && status.battery_life_percent <= 100
        {
            let is_charging = (status.battery_flag & 8) != 0 || status.ac_line_status == 1;
            return (true, status.battery_life_percent, is_charging);
        }
    }
    (false, 0, false)
}

#[cfg(not(windows))]
fn get_native_battery_status() -> (bool, u8, bool) {
    (false, 0, false)
}

/// Returns `true` if the interface name appears to represent a physical adapter.
/// Excludes loopback (`lo`, `loopback`) and common virtual/VPN/capture drivers
/// without falsely rejecting Windows `"Local Area Connection"` adapters.
pub fn is_physical_interface(name: &str) -> bool {
    let n = name.trim().to_lowercase();
    if n.is_empty() || n == "lo" {
        return false;
    }

    const IGNORED_KEYWORDS: &[&str] = &[
        "loopback",
        "vethernet",
        "virtual",
        "vmware",
        "docker",
        "hyper-v",
        "wsl",
        "npcap",
        "tailscale",
        "wireguard",
        "bluetooth",
    ];

    !IGNORED_KEYWORDS.iter().any(|kw| n.contains(kw))
}

fn sample_snapshot(
    sys: &mut System,
    networks: &mut Networks,
    rx_speed: u64,
    tx_speed: u64,
) -> SystemMetrics {
    sys.refresh_cpu_specifics(CpuRefreshKind::nothing().with_cpu_usage());
    sys.refresh_memory();
    networks.refresh(true);

    let cpu_usage = sys.global_cpu_usage();
    let total_memory = sys.total_memory();
    let used_memory = sys.used_memory();

    let (total_rx, total_tx) = networks
        .iter()
        .filter(|(name, _)| is_physical_interface(name))
        .fold((0, 0), |acc, (_, data)| {
            (
                acc.0 + data.total_received(),
                acc.1 + data.total_transmitted(),
            )
        });

    let (battery_available, battery_level, is_charging) = get_native_battery_status();

    SystemMetrics {
        cpu_usage,
        total_memory,
        used_memory,
        total_rx,
        total_tx,
        rx_speed,
        tx_speed,
        battery_available,
        battery_level,
        is_charging,
    }
}

fn notify_sampler(app: &tauri::AppHandle) {
    if let Some(state) = app.try_state::<AppState>() {
        let (lock, cvar) = &*state.wakeup;
        if let Ok(mut notified) = lock.lock() {
            *notified = true;
            cvar.notify_one();
        }
    }
}

fn restore_and_focus_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        notify_sampler(app);
    }
}

#[tauri::command]
fn get_metrics(state: State<AppState>) -> SystemMetrics {
    {
        let cached = state
            .latest_metrics
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        if cached.total_memory > 0 {
            return cached.clone();
        }
    }

    let mut sys = state.system.lock().unwrap_or_else(|e| e.into_inner());
    let mut networks = state.networks.lock().unwrap_or_else(|e| e.into_inner());
    let snapshot = sample_snapshot(&mut sys, &mut networks, 0, 0);

    if let Ok(mut cached) = state.latest_metrics.lock() {
        *cached = snapshot.clone();
    }
    snapshot
}

#[tauri::command]
fn set_tray_language(lang: String, tray_state: State<TrayMenuState>) {
    let (show_text, quit_text) = if lang == "zh" {
        ("显示悬浮窗", "退出程序")
    } else {
        ("Show Widget", "Quit Toolkit")
    };
    let _ = tray_state.show_item.set_text(show_text);
    let _ = tray_state.quit_item.set_text(quit_text);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            restore_and_focus_window(app);
        }))
        .plugin(
            WindowStateBuilder::default()
                .with_state_flags(StateFlags::POSITION)
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .setup(|app| {
            // Precise initialization to avoid scanning processes, disks, users on cold start
            let mut sys = System::new_with_specifics(
                RefreshKind::nothing()
                    .with_cpu(CpuRefreshKind::nothing().with_cpu_usage())
                    .with_memory(MemoryRefreshKind::everything()),
            );
            let mut networks = Networks::new_with_refreshed_list();
            let initial_metrics = sample_snapshot(&mut sys, &mut networks, 0, 0);

            let wakeup = Arc::new((Mutex::new(false), Condvar::new()));
            app.manage(AppState {
                system: Mutex::new(sys),
                networks: Mutex::new(networks),
                latest_metrics: Mutex::new(initial_metrics),
                wakeup: wakeup.clone(),
            });

            // Set up System Tray menu (defaults to English, synced dynamically by frontend)
            let show_i = MenuItem::with_id(app, "show", "Show Widget", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit Toolkit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            app.manage(TrayMenuState {
                show_item: show_i.clone(),
                quit_item: quit_i.clone(),
            });

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => restore_and_focus_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let is_visible = window.is_visible().unwrap_or(false);
                            let is_minimized = window.is_minimized().unwrap_or(false);
                            if is_visible && !is_minimized {
                                let _ = window.hide();
                            } else {
                                restore_and_focus_window(app);
                            }
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }
            let _ = tray_builder.build(app);

            // Handle --autostart silent launch flag
            let launched_by_autostart = std::env::args().any(|arg| arg == "--autostart");
            if !launched_by_autostart {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                }
            }

            // Background event-driven metrics streaming (pauses automatically when window is hidden/minimized)
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut last_instant = std::time::Instant::now();
                let mut last_rx: u64 = 0;
                let mut last_tx: u64 = 0;
                let mut is_first = true;

                loop {
                    {
                        let (lock, cvar) = &*wakeup;
                        let mut notified = lock.lock().unwrap_or_else(|e| e.into_inner());
                        if !*notified {
                            let result = cvar
                                .wait_timeout(notified, std::time::Duration::from_secs(1))
                                .unwrap_or_else(|e| e.into_inner());
                            notified = result.0;
                        }
                        *notified = false;
                    }

                    let is_active = app_handle
                        .get_webview_window("main")
                        .map(|w| {
                            w.is_visible().unwrap_or(false) && !w.is_minimized().unwrap_or(false)
                        })
                        .unwrap_or(false);

                    if !is_active {
                        is_first = true;
                        continue;
                    }

                    let state = app_handle.state::<AppState>();
                    let mut snapshot = {
                        let mut sys = state.system.lock().unwrap_or_else(|e| e.into_inner());
                        let mut networks = state.networks.lock().unwrap_or_else(|e| e.into_inner());
                        sample_snapshot(&mut sys, &mut networks, 0, 0)
                    };

                    let now = std::time::Instant::now();
                    let elapsed = now.duration_since(last_instant).as_secs_f64();
                    last_instant = now;

                    let (rx_speed, tx_speed) = if is_first {
                        is_first = false;
                        last_rx = snapshot.total_rx;
                        last_tx = snapshot.total_tx;
                        (0, 0)
                    } else if elapsed > 0.0 {
                        let rx_diff = snapshot.total_rx.saturating_sub(last_rx);
                        let tx_diff = snapshot.total_tx.saturating_sub(last_tx);
                        last_rx = snapshot.total_rx;
                        last_tx = snapshot.total_tx;
                        (
                            (rx_diff as f64 / elapsed).round() as u64,
                            (tx_diff as f64 / elapsed).round() as u64,
                        )
                    } else {
                        (0, 0)
                    };

                    snapshot.rx_speed = rx_speed;
                    snapshot.tx_speed = tx_speed;

                    if let Ok(mut cached) = state.latest_metrics.lock() {
                        *cached = snapshot.clone();
                    }

                    let _ = app_handle.emit("sys://metrics", &snapshot);
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![get_metrics, set_tray_language])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::is_physical_interface;

    #[test]
    fn filters_loopback_and_virtual_adapters() {
        assert!(!is_physical_interface("lo"));
        assert!(!is_physical_interface("LO"));
        assert!(!is_physical_interface("Loopback Pseudo-Interface 1"));
        assert!(!is_physical_interface("vEthernet (WSL)"));
        assert!(!is_physical_interface("VMware Network Adapter VMnet8"));
        assert!(!is_physical_interface("DockerNAT"));
        assert!(!is_physical_interface("Tailscale Tunnel"));
        assert!(!is_physical_interface("WireGuard Tunnel"));
        assert!(!is_physical_interface("Npcap Loopback Adapter"));
        assert!(!is_physical_interface(""));
        assert!(!is_physical_interface("   "));
    }

    #[test]
    fn retains_physical_adapters_including_lo_prefixed_names() {
        assert!(is_physical_interface("Local Area Connection"));
        assert!(is_physical_interface("Local Area Connection* 2"));
        assert!(is_physical_interface("Ethernet"));
        assert!(is_physical_interface("Wi-Fi"));
        assert!(is_physical_interface("en0"));
        assert!(is_physical_interface("wlan0"));
    }
}
