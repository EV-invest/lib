//! Native OpenTelemetry: OTLP/HTTP logs + traces, wired into `tracing`. The
//! export is HTTP (reqwest-blocking) with thread-based batching so it builds
//! before the tokio runtime exists; the tonic bits below are only the W3C
//! trace-context propagation across the money-flow gRPC services.

use opentelemetry::trace::TracerProvider as _;
use opentelemetry_appender_tracing::layer::OpenTelemetryTracingBridge;
use opentelemetry_sdk::{
	Resource,
	logs::SdkLoggerProvider,
	propagation::TraceContextPropagator,
	trace::{Sampler, SdkTracerProvider},
};
use tonic::{Request, Status};
use tracing_opentelemetry::OpenTelemetrySpanExt;
use tracing_subscriber::{Layer, registry::LookupSpan};

/// Telemetry configuration. `environment` picks the trace sampling rate; the OTLP
/// endpoint and the `Resource` (`service.name`, `service.version`,
/// `deployment.environment`) are read from the standard `OTEL_*` env by the SDK.
#[derive(Clone, Debug)]
pub struct Config {
	pub environment: String,
	pub traces_sample_rate: f64,
}

impl Config {
	/// 10% of traces in production, 100% elsewhere (mirrors the Sentry policy).
	pub fn traces_sample_rate_for(environment: &str) -> f64 {
		if environment == "production" { 0.1 } else { 1.0 }
	}
}

/// Held for the lifetime of `main`; dropping it flushes and shuts down both
/// providers so buffered logs/spans are exported before exit.
pub struct Telemetry {
	logger_provider: SdkLoggerProvider,
	tracer_provider: SdkTracerProvider,
}

impl Drop for Telemetry {
	fn drop(&mut self) {
		if let Err(e) = self.tracer_provider.shutdown() {
			tracing::warn!(error = %e, "otel tracer provider shutdown");
		}
		if let Err(e) = self.logger_provider.shutdown() {
			tracing::warn!(error = %e, "otel logger provider shutdown");
		}
	}
}

/// Builds the OTel logs + traces `tracing` layers and their lifetime guard, or
/// `None` when `OTEL_EXPORTER_OTLP_ENDPOINT` is unset (telemetry off) or an
/// exporter fails to build (warned, never panics). Add the returned layers to the
/// subscriber registry and hold the guard in `main`:
///
/// ```ignore
/// let (otel_guard, otel_layers) = ev::otel::telemetry(&cfg).unzip();
/// registry().with(filter).with(fmt::layer().json()).with(otel_layers).init();
/// // keep `otel_guard` bound for the process lifetime
/// ```
pub fn telemetry<S>(config: &Config) -> Option<(Telemetry, Vec<Box<dyn Layer<S> + Send + Sync + 'static>>)>
where
	S: tracing::Subscriber + for<'a> LookupSpan<'a> + Send + Sync, {
	std::env::var_os("OTEL_EXPORTER_OTLP_ENDPOINT")?;

	// `Resource::builder` runs the env detector: OTEL_SERVICE_NAME + OTEL_RESOURCE_ATTRIBUTES.
	let resource = Resource::builder().build();

	let log_exporter = match opentelemetry_otlp::LogExporter::builder().with_http().build() {
		Ok(exporter) => exporter,
		Err(e) => {
			tracing::warn!(error = %e, "otel log exporter build failed; telemetry disabled");
			return None;
		}
	};
	let logger_provider = SdkLoggerProvider::builder().with_resource(resource.clone()).with_batch_exporter(log_exporter).build();

	let span_exporter = match opentelemetry_otlp::SpanExporter::builder().with_http().build() {
		Ok(exporter) => exporter,
		Err(e) => {
			tracing::warn!(error = %e, "otel span exporter build failed; telemetry disabled");
			return None;
		}
	};
	let tracer_provider = SdkTracerProvider::builder()
		.with_resource(resource)
		.with_sampler(Sampler::ParentBased(Box::new(Sampler::TraceIdRatioBased(config.traces_sample_rate))))
		.with_batch_exporter(span_exporter)
		.build();

	opentelemetry::global::set_text_map_propagator(TraceContextPropagator::new());

	let logs_layer = OpenTelemetryTracingBridge::new(&logger_provider);
	let traces_layer = tracing_opentelemetry::layer().with_tracer(tracer_provider.tracer("ev"));
	let layers: Vec<Box<dyn Layer<S> + Send + Sync + 'static>> = vec![Box::new(logs_layer), Box::new(traces_layer)];

	Some((Telemetry { logger_provider, tracer_provider }, layers))
}

/// tonic **client** interceptor: injects the current span's W3C `traceparent` into
/// outgoing gRPC metadata. Attach with `.with_interceptor(inject_trace_context)`.
pub fn inject_trace_context(mut req: Request<()>) -> Result<Request<()>, Status> {
	let context = tracing::Span::current().context();
	opentelemetry::global::get_text_map_propagator(|propagator| propagator.inject_context(&context, &mut MetadataInjector(req.metadata_mut())));
	Ok(req)
}
/// tonic **server** interceptor: extracts an inbound `traceparent` and sets it as
/// the parent of the current span, so the server span joins the caller's trace.
pub fn extract_trace_context(req: Request<()>) -> Result<Request<()>, Status> {
	let parent = opentelemetry::global::get_text_map_propagator(|propagator| propagator.extract(&MetadataExtractor(req.metadata())));
	// Errors only as `LayerNotFound` — i.e. telemetry is off and the OTel layer
	// isn't installed. Benign: with no exporter there's no trace to join anyway.
	let _ = tracing::Span::current().set_parent(parent);
	Ok(req)
}
struct MetadataInjector<'a>(&'a mut tonic::metadata::MetadataMap);

impl opentelemetry::propagation::Injector for MetadataInjector<'_> {
	fn set(&mut self, key: &str, value: String) {
		if let (Ok(key), Ok(value)) = (tonic::metadata::MetadataKey::from_bytes(key.as_bytes()), value.parse()) {
			self.0.insert(key, value);
		}
	}
}

struct MetadataExtractor<'a>(&'a tonic::metadata::MetadataMap);

impl opentelemetry::propagation::Extractor for MetadataExtractor<'_> {
	fn get(&self, key: &str) -> Option<&str> {
		self.0.get(key).and_then(|v| v.to_str().ok())
	}

	fn keys(&self) -> Vec<&str> {
		self.0
			.keys()
			.filter_map(|k| match k {
				tonic::metadata::KeyRef::Ascii(k) => Some(k.as_str()),
				tonic::metadata::KeyRef::Binary(_) => None,
			})
			.collect()
	}
}
