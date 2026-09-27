//! The alerts feature against a fake Discord webhook.

use std::{
	fs,
	path::Path,
	sync::{Arc, Mutex},
	time::{Duration, SystemTime},
};

use axum::{Router, extract::Multipart, routing::post};
use ev_lib::alerts::{Artifacts, Config, Webhooks, alerts};
use tracing_subscriber::prelude::*;

/// What the webhook got: each message's content and its files' names.
type Got = Vec<(String, Vec<String>)>;

async fn webhook() -> (reqwest::Url, Arc<Mutex<Got>>) {
	let got = Arc::new(Mutex::new(Got::new()));
	let sink = got.clone();
	let app = Router::new().route(
		"/hook",
		post(move |mut form: Multipart| async move {
			let mut content = String::new();
			let mut files = vec![];
			while let Some(field) = form.next_field().await.unwrap() {
				match field.name().unwrap() {
					"payload_json" => {
						let payload: serde_json::Value = serde_json::from_str(&field.text().await.unwrap()).unwrap();
						content = payload["content"].as_str().unwrap().to_owned();
					}
					name => {
						assert!(name.starts_with("files["), "{name}");
						files.push(field.file_name().unwrap().to_owned());
					}
				}
			}
			sink.lock().unwrap().push((content, files));
		}),
	);
	let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
	let url = format!("http://{}/hook", listener.local_addr().unwrap()).parse().unwrap();
	tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
	(url, got)
}

/// Runs `log` under the layer, then delivers everything it queued.
async fn check(artifacts: &Artifacts, log: impl FnOnce()) -> Got {
	let (url, got) = webhook().await;
	let (layer, deliverer) = alerts(Config {
		artifacts: artifacts.clone(),
		webhooks: Webhooks { error: url.clone(), warn: url },
		service: "test".into(),
	});
	tracing::subscriber::with_default(tracing_subscriber::registry().with(layer), log);
	// the layer went with the subscriber, so this returns once the queue is drained
	deliverer.run(std::future::pending()).await;
	got.lock().unwrap().clone()
}

fn name(path: &Path) -> String {
	path.file_name().unwrap().to_string_lossy().into_owned()
}

#[tokio::test]
async fn paths_under_the_root_are_attached() {
	let dir = tempfile::tempdir().unwrap();
	let artifacts = Artifacts::open(dir.path().join("artifacts")).unwrap();
	let png = artifacts.save("blocked", "png", b"png").unwrap();
	let html = artifacts.save("blocked", "html", b"<html>").unwrap();
	let outside = dir.path().join("secret.txt");
	fs::write(&outside, "hunter2").unwrap();

	let got = check(&artifacts, || {
		tracing::error!("blocked: page [{}], html [{}], and [{}]", png.display(), html.display(), outside.display());
		tracing::info!("not an alert [{}]", png.display());
	})
	.await;

	assert_eq!(got.len(), 1, "{got:?}");
	let (content, files) = &got[0];
	assert!(content.contains("blocked: page") && content.contains("ERROR"), "{content}");
	assert_eq!(files, &[name(&png), name(&html)]);
}

#[tokio::test]
async fn nothing_to_attach_is_not_sent() {
	let dir = tempfile::tempdir().unwrap();
	let artifacts = Artifacts::open(dir.path().join("artifacts")).unwrap();
	let outside = dir.path().join("secret.txt");
	fs::write(&outside, "hunter2").unwrap();
	let escape = artifacts.save("x", "png", b"png").unwrap().parent().unwrap().join("../secret.txt");

	let got = check(&artifacts, || {
		tracing::error!("[{}] [{}] [/etc/passwd]", outside.display(), escape.display());
	})
	.await;

	assert_eq!(got, Got::new());
}

#[tokio::test]
async fn too_big_goes_in_a_note() {
	let dir = tempfile::tempdir().unwrap();
	let artifacts = Artifacts::open(dir.path().join("artifacts")).unwrap();
	let big = artifacts.save("big", "png", &vec![0; 11 * 1024 * 1024]).unwrap();
	let small = artifacts.save("small", "png", b"png").unwrap();

	let got = check(&artifacts, || {
		tracing::warn!(page = %format!("[{}]", big.display()), html = %format!("[{}]", small.display()), "stuck");
	})
	.await;

	assert_eq!(got.len(), 2, "{got:?}");
	assert_eq!(got[0].1, [name(&small)]);
	assert!(
		got[1].0.starts_with("not included:") && got[1].0.contains(&name(&big)) && got[1].0.contains("11.0 MiB"),
		"{}",
		got[1].0
	);
	assert!(got[1].1.is_empty());
}

#[tokio::test]
async fn one_callsite_alerts_once_per_window() {
	let dir = tempfile::tempdir().unwrap();
	let artifacts = Artifacts::open(dir.path().join("artifacts")).unwrap();
	let png = artifacts.save("blocked", "png", b"png").unwrap();

	let got = check(&artifacts, || {
		for _ in 0..3 {
			tracing::error!("blocked [{}]", png.display());
		}
	})
	.await;

	assert_eq!(got.len(), 1, "{got:?}");
}

#[test]
fn a_week_old_artifact_is_pruned_on_save() {
	let dir = tempfile::tempdir().unwrap();
	let artifacts = Artifacts::open(dir.path()).unwrap();
	let old = artifacts.save("old", "png", b"png").unwrap();
	let recent = artifacts.save("recent", "png", b"png").unwrap();
	fs::File::options()
		.write(true)
		.open(&old)
		.unwrap()
		.set_modified(SystemTime::now() - Duration::from_secs(8 * 24 * 3600))
		.unwrap();

	artifacts.save("new", "png", b"png").unwrap();

	assert!(!old.exists());
	assert!(recent.exists());
}
