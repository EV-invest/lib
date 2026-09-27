//! `alerts` — the files a WARN/ERROR log line points at, delivered to Discord.
//!
//! [`Artifacts`] is where an app saves what it wants a human to see (a screenshot of
//! the stuck page, its HTML); the path it hands back goes into the error as `[<path>]`.
//! [`AlertLayer`] watches WARN/ERROR events for such `[<path>]`s and, for those that
//! resolve under the artifacts root, queues the line with its files; [`Deliverer`]
//! posts them to the level's webhook. The root is a trust boundary: a log line can't
//! get `/etc/…` attached. Lines without artifacts are not sent here — the log
//! pipeline's own alerting carries text.
//!
//! ```ignore
//! let artifacts = Artifacts::open(data_dir.join("artifacts"))?;
//! let (layer, deliverer) = alerts(Config { artifacts: artifacts.clone(), webhooks, service: "review-archive".into() });
//! registry().with(layer).init();
//! tokio::join!(app(artifacts), deliverer.run(shutdown));
//! ```

use std::{
	collections::HashMap,
	fmt::Write as _,
	fs,
	future::Future,
	io::{self, Write as _},
	path::{Path, PathBuf},
	sync::{
		Mutex,
		atomic::{AtomicUsize, Ordering},
	},
	time::{Duration, Instant, SystemTime},
};

use reqwest::{
	Url,
	multipart::{Form, Part},
};
use tokio::sync::mpsc;
use tracing::{Event, Level, Subscriber, callsite::Identifier, field::Field};
use tracing_subscriber::{Layer, layer::Context};

pub const RETENTION: Duration = Duration::from_secs(7 * 24 * 3600);
/// Grafana's `group_interval`, so a flood of one failure is one message on both paths.
const DEDUPE: Duration = Duration::from_secs(5 * 60);
const QUEUE: usize = 16;
/// Discord's per-message limits on an unboosted server.
const MAX_FILES: usize = 10;
const MAX_BYTES: u64 = 10 * 1024 * 1024;
const MAX_CONTENT: usize = 2000;

/// A directory owned by the app's artifacts: every file in it older than [`RETENTION`]
/// is deleted, on open and on every save.
#[derive(Clone, Debug)]
pub struct Artifacts {
	root: PathBuf,
}

impl Artifacts {
	pub fn open(root: impl AsRef<Path>) -> io::Result<Self> {
		fs::create_dir_all(&root)?;
		let root = fs::canonicalize(root)?;
		assert!(!root.to_string_lossy().contains(']'), "a `]` in {} would cut its paths short in log lines", root.display());
		let artifacts = Self { root };
		artifacts.prune()?;
		Ok(artifacts)
	}

	/// Writes `<root>/<utc timestamp>-<hint>.<ext>`.
	pub fn save(&self, hint: &str, ext: &str, bytes: &[u8]) -> io::Result<PathBuf> {
		assert!(
			hint.chars().chain(ext.chars()).all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'),
			"{hint:?}.{ext:?} is a file name, not a path"
		);
		let path = self.root.join(format!("{}-{hint}.{ext}", jiff::Timestamp::now().strftime("%Y%m%dT%H%M%S%.3fZ")));
		fs::OpenOptions::new().write(true).create_new(true).open(&path)?.write_all(bytes)?;
		self.prune()?;
		Ok(path)
	}

	fn prune(&self) -> io::Result<()> {
		let cutoff = SystemTime::now() - RETENTION;
		for entry in fs::read_dir(&self.root)? {
			let entry = entry?;
			let old = match entry.metadata() {
				Ok(meta) => meta.is_file() && meta.modified()? < cutoff,
				Err(e) if e.kind() == io::ErrorKind::NotFound => continue, // a concurrent prune got it first
				Err(e) => return Err(e),
			};
			if old {
				match fs::remove_file(entry.path()) {
					Err(e) if e.kind() != io::ErrorKind::NotFound => return Err(e), // NotFound: a concurrent prune got it first
					_ => {}
				}
			}
		}
		Ok(())
	}
}

#[derive(Clone, Debug)]
pub struct Webhooks {
	pub error: Url,
	pub warn: Url,
}

#[derive(Clone, Debug)]
pub struct Config {
	pub artifacts: Artifacts,
	pub webhooks: Webhooks,
	/// Names the app in each message; the channel may be shared.
	pub service: String,
}

/// The layer goes into the subscriber registry; the deliverer is a future the app
/// awaits next to its own work — nothing is sent until it runs.
pub fn alerts(config: Config) -> (AlertLayer, Deliverer) {
	let (tx, rx) = mpsc::channel(QUEUE);
	let layer = AlertLayer {
		root: config.artifacts.root,
		tx,
		last_sent: Mutex::default(),
		dropped: AtomicUsize::new(0),
	};
	let deliverer = Deliverer {
		rx,
		webhooks: config.webhooks,
		service: config.service,
		// a hung webhook must not hold up the app's shutdown, which waits for the queue
		http: reqwest::Client::builder().timeout(Duration::from_secs(30)).build().expect("the TLS backend initialises"),
	};
	(layer, deliverer)
}

struct Alert {
	level: Level,
	target: &'static str,
	line: String,
	files: Vec<PathBuf>,
	dropped: usize,
}

pub struct AlertLayer {
	root: PathBuf,
	tx: mpsc::Sender<Alert>,
	last_sent: Mutex<HashMap<(Identifier, Level), Instant>>,
	dropped: AtomicUsize,
}

impl<S: Subscriber> Layer<S> for AlertLayer {
	fn on_event(&self, event: &Event<'_>, _: Context<'_, S>) {
		let meta = event.metadata();
		let level = *meta.level();
		if level > Level::WARN {
			return;
		}
		let mut line = Line::default();
		event.record(&mut line);
		let line = line.0;
		// canonical, so `<root>/../x` and symlinks out of the root are not under it
		let files: Vec<PathBuf> = line
			.split('[')
			.skip(1)
			.filter_map(|rest| rest.split_once(']'))
			.filter(|(path, _)| path.starts_with('/'))
			.filter_map(|(path, _)| fs::canonicalize(path).ok()) // missing: stays plain text, like any other path
			.filter(|path| path.starts_with(&self.root) && path.is_file())
			.collect();
		if files.is_empty() {
			return;
		}

		let key = (meta.callsite(), level);
		let now = Instant::now();
		{
			let mut last_sent = self.last_sent.lock().expect("nothing under this lock panics");
			if last_sent.get(&key).is_some_and(|at| now.duration_since(*at) < DEDUPE) {
				return;
			}
			last_sent.insert(key, now);
		}

		let alert = Alert {
			level,
			target: meta.target(),
			line,
			files,
			dropped: self.dropped.swap(0, Ordering::Relaxed),
		};
		if let Err(e) = self.tx.try_send(alert) {
			self.dropped.fetch_add(1 + e.into_inner().dropped, Ordering::Relaxed);
		}
	}
}

#[derive(Default)]
struct Line(String);

impl tracing::field::Visit for Line {
	fn record_str(&mut self, field: &Field, value: &str) {
		self.record_debug(field, &format_args!("{value}"));
	}

	fn record_debug(&mut self, field: &Field, value: &dyn std::fmt::Debug) {
		if !self.0.is_empty() {
			self.0.push(' ');
		}
		match field.name() {
			"message" => write!(self.0, "{value:?}"),
			name => write!(self.0, "{name}={value:?}"),
		}
		.expect("writing to a String");
	}
}

pub struct Deliverer {
	rx: mpsc::Receiver<Alert>,
	webhooks: Webhooks,
	service: String,
	http: reqwest::Client,
}

impl Deliverer {
	/// Delivers until `shutdown`, then what is already queued; or until the layer is dropped.
	pub async fn run(mut self, shutdown: impl Future<Output = ()>) {
		let mut shutdown = std::pin::pin!(shutdown);
		loop {
			tokio::select! {
				biased;
				alert = self.rx.recv() => match alert {
					Some(alert) => self.deliver(alert).await,
					None => return,
				},
				() = &mut shutdown => break,
			}
		}
		self.rx.close();
		while let Some(alert) = self.rx.recv().await {
			self.deliver(alert).await;
		}
	}

	async fn deliver(&self, alert: Alert) {
		let url = if alert.level == Level::ERROR { &self.webhooks.error } else { &self.webhooks.warn };

		let mut packs: Vec<Vec<(PathBuf, Vec<u8>)>> = vec![vec![]];
		let mut packed_bytes = 0;
		let mut left_out = vec![];
		for path in alert.files {
			let bytes = match tokio::fs::read(&path).await {
				Ok(bytes) => bytes,
				Err(e) => {
					left_out.push(format!("{} ({e})", path.display()));
					continue;
				}
			};
			let size = bytes.len() as u64;
			if size > MAX_BYTES {
				left_out.push(format!(
					"{} ({:.1} MiB) exceeds {} MiB — kubectl cp from the pod",
					path.display(),
					size as f64 / (1024.0 * 1024.0),
					MAX_BYTES / (1024 * 1024)
				));
				continue;
			}
			let pack = packs.last_mut().expect("starts with one");
			if pack.len() == MAX_FILES || packed_bytes + size > MAX_BYTES {
				packs.push(vec![]);
				packed_bytes = 0;
			}
			packs.last_mut().expect("just pushed").push((path, bytes));
			packed_bytes += size;
		}

		let mut head = format!("**{}** {} `{}`\n{}", self.service, alert.level, alert.target, alert.line);
		if alert.dropped > 0 {
			head.push_str(&format!("\n({} alerts dropped before this one: queue full)", alert.dropped));
		}
		for (i, pack) in packs.into_iter().enumerate() {
			self.post(url, if i == 0 { &head } else { "(cont.)" }, pack).await;
		}
		if !left_out.is_empty() {
			self.post(url, &format!("not included:\n{}", left_out.join("\n")), vec![]).await;
		}
	}

	async fn post(&self, url: &Url, content: &str, files: Vec<(PathBuf, Vec<u8>)>) {
		let content: String = match content.char_indices().nth(MAX_CONTENT - 1) {
			Some((end, _)) => format!("{}…", &content[..end]),
			None => content.to_owned(),
		};
		let payload = serde_json::json!({ "content": content, "allowed_mentions": { "parse": [] } });
		let mut form = Form::new().text("payload_json", payload.to_string());
		for (i, (path, bytes)) in files.into_iter().enumerate() {
			let name = path.file_name().expect("a saved artifact is a file").to_string_lossy().into_owned();
			form = form.part(format!("files[{i}]"), Part::bytes(bytes).file_name(name));
		}
		// logged without the paths, which would come back here as an alert
		match self.http.post(url.clone()).multipart(form).send().await {
			Ok(r) if r.status().is_success() => {}
			Ok(r) => tracing::warn!(status = %r.status(), "alert delivery refused"),
			Err(e) => tracing::warn!(error = %e.without_url(), "alert delivery failed"),
		}
	}
}
