//! `watch_drift()` against a temp dir standing in for the mounted Secret, on paused time.

use std::{
	convert::Infallible,
	fs,
	io::Write,
	path::Path,
	pin::Pin,
	sync::{Arc, Mutex},
	time::Duration,
};

ev_lib::settings! {
	struct Settings, prefix = "DRIFT_TEST" {
		smtp_host: String,
		#[secret]
		api_token: Option<String>,
	}
}

const MINUTE: Duration = Duration::from_secs(60);
#[derive(Clone, Default)]
struct Log(Arc<Mutex<Vec<u8>>>);
impl Log {
	fn take(&self) -> String {
		String::from_utf8(std::mem::take(&mut *self.0.lock().unwrap())).unwrap()
	}
}

impl Write for Log {
	fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
		self.0.lock().unwrap().write(buf)
	}

	fn flush(&mut self) -> std::io::Result<()> {
		Ok(())
	}
}

async fn run_for(watch: Pin<&mut impl Future<Output = Infallible>>, duration: Duration) {
	tokio::select! {
		biased;
		never = watch => match never {},
		() = tokio::time::sleep(duration) => {}
	}
}

/// One test: `SETTINGS_DRIFT_MOUNT` is process-global, so the cases run in sequence.
#[tokio::test(start_paused = true)]
async fn watch_drift() {
	let log = Log::default();
	let writer = log.clone();
	let _guard = tracing::subscriber::set_default(tracing_subscriber::fmt().with_writer(move || writer.clone()).with_ansi(false).finish());
	let dir = tempfile::tempdir().unwrap();
	let set_mount = |mount: Option<&Path>| match mount {
		// SAFETY: the only test in this binary, on a current-thread runtime
		Some(mount) => unsafe { std::env::set_var("SETTINGS_DRIFT_MOUNT", mount) },
		None => unsafe { std::env::remove_var("SETTINGS_DRIFT_MOUNT") },
	};

	// unset: idles, silently
	set_mount(None);
	run_for(std::pin::pin!(Settings::watch_drift()), 60 * MINUTE).await;
	assert_eq!(log.take(), "");

	// not a directory: says so once, then idles
	set_mount(Some(&dir.path().join("missing")));
	run_for(std::pin::pin!(Settings::watch_drift()), 60 * MINUTE).await;
	let got = log.take();
	assert_eq!(got.matches("does not point at a directory").count(), 1, "{got}");

	// the baseline is the mount, and a drift repeats every poll
	set_mount(Some(dir.path()));
	fs::write(dir.path().join("DRIFT_TEST_SMTP_HOST"), "smtp.example").unwrap();
	let mut watch = std::pin::pin!(Settings::watch_drift());
	run_for(watch.as_mut(), MINUTE).await;
	fs::write(dir.path().join("DRIFT_TEST_SMTP_HOST"), "smtp.elsewhere").unwrap();
	fs::write(dir.path().join("DRIFT_TEST_API_TOKEN"), "hunter2").unwrap();
	run_for(watch.as_mut(), 3 * MINUTE).await;
	assert_eq!(log.take(), "", "reported before the interval");
	run_for(watch.as_mut(), 2 * MINUTE).await;
	let got = log.take();
	assert!(got.contains("DRIFT_TEST_SMTP_HOST: changed since boot"), "{got}");
	assert!(got.contains("DRIFT_TEST_API_TOKEN: appeared since boot"), "{got}");
	assert!(!got.contains("hunter2") && !got.contains("elsewhere"), "{got}");
	run_for(watch.as_mut(), 5 * MINUTE).await;
	assert_eq!(log.take().matches("since boot").count(), 2);
}
