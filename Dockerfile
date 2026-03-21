# =============================================================================
# Kernexa — Dockerfile
# Stage 1: Build React frontend
# Stage 2: Python/FastAPI backend with correct file ownership for appuser
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
# Stage 2 — Python/FastAPI backend
# -----------------------------------------------------------------------------
FROM python:3.10-slim

# krb5-user + libkrb5-dev + gcc are required to compile gssapi and kerberos
# Python packages from requirements.txt (they have C extensions that need
# krb5-config to be present at build time)
RUN apt-get update && apt-get install -y \
    sshpass \
    curl \
    openssh-client \
    krb5-user \
    libkrb5-dev \
    gcc \
    && apt-get upgrade -y libc6 libc-bin \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user and writable dirs BEFORE copying any files.
RUN useradd -m appuser \
    && mkdir -p /app/env /app/inventory /app/artifacts /app/tmp \
    && chown -R appuser:appuser /app

WORKDIR /app

# Install Python dependencies as root (needs write access to site-packages)
COPY --chown=appuser:appuser requirements.txt .
RUN pip install -r requirements.txt \
    && pip install --upgrade --force-reinstall "wheel>=0.46.2" "jaraco.context>=6.1.0"

# Copy application source — owned by appuser at copy time
COPY --chown=appuser:appuser . .

# Copy React build output from Stage 1
COPY --chown=appuser:appuser --from=frontend /app/dist ./dist

# Switch to non-root user for runtime
USER appuser

# Init DB tables then start FastAPI
CMD ["sh", "-c", "python3 init_db.py && uvicorn main:app --host 0.0.0.0 --port 8000"]