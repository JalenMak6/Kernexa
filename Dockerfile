# =============================================================================
# Kernexa — Dockerfile
# Stage 1: Build React frontend
# Stage 2: Python Builder (Compiles C extensions, no app code)
# Stage 3: Python/FastAPI Runner (Secure, no compilers, non-root)
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1 — Build React frontend
# -----------------------------------------------------------------------------
FROM node:20-alpine AS frontend
WORKDIR /app
COPY patch-scan-ui/package*.json ./
RUN npm install
COPY patch-scan-ui/ ./
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2 — Python Builder (Compile dependencies)
# -----------------------------------------------------------------------------
FROM python:3.10-slim AS backend-builder
WORKDIR /app

# Install heavy BUILD dependencies (gcc, dev headers)
RUN apt-get update && apt-get install -y \
    krb5-user \
    libkrb5-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and compile them into Python wheels
COPY requirements.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r requirements.txt \
    && pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels "wheel>=0.46.2" "jaraco.context>=6.1.0"

# -----------------------------------------------------------------------------
# Stage 3 — Final Runtime Image
# -----------------------------------------------------------------------------
FROM python:3.10-slim

# Install ONLY runtime dependencies (No gcc, no libkrb5-dev)
RUN apt-get update && apt-get install -y \
    sshpass \
    curl \
    openssh-client \
    krb5-user \
    && apt-get upgrade -y libc6 libc-bin \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m appuser \
    && mkdir -p /app/env /app/inventory /app/artifacts /app/tmp \
    && chown -R appuser:appuser /app

WORKDIR /app

# Copy compiled wheels from Stage 2 and install them
COPY --from=backend-builder /app/wheels /wheels
RUN pip install --no-cache /wheels/* \
    && rm -rf /wheels

# Copy application source
COPY --chown=appuser:appuser . .

# Copy React build output from Stage 1
COPY --chown=appuser:appuser --from=frontend /app/dist ./dist

# Switch to non-root user for runtime
USER appuser

# Init DB tables then start FastAPI
CMD ["sh", "-c", "python3 init_db.py && uvicorn main:app --host 0.0.0.0 --port 8000"]
