# ============================================================
# Stage 1: Build the Rust binary
# ============================================================
FROM rust:1.83-bookworm AS builder

WORKDIR /build

# Cache dependencies - copy manifests first
COPY Cargo.toml Cargo.lock* ./
RUN mkdir src && echo 'fn main() {}' > src/main.rs && \
    cargo build --release 2>/dev/null || true && \
    rm -rf src

# Build actual source
COPY src/ ./src/
RUN cargo build --release --bin bootstrap

# ============================================================
# Stage 2: Lambda runtime image
# ============================================================
FROM public.ecr.aws/lambda/provided:al2023

COPY --from=builder /build/target/release/bootstrap ${LAMBDA_RUNTIME_DIR}/bootstrap

CMD ["bootstrap"]
