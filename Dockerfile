# =============================================================================
# Kermonix — Dockerfile
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
FROM python:3.12-slim AS backend-builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    krb5-user \
    libkrb5-dev \
    gcc \
    && apt-get upgrade -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r requirements.txt \
    && pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels "wheel>=0.46.2" "jaraco.context>=6.1.0"

# -----------------------------------------------------------------------------
# Stage 3 — Final Runtime Image
# -----------------------------------------------------------------------------
FROM python:3.12-slim

# git is required for ansible-galaxy to install roles from GitHub
RUN apt-get update && apt-get install -y \
    sshpass \
    curl \
    openssh-client \
    krb5-user \
    git \
    && apt-get upgrade -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m appuser \
    && mkdir -p /app/env /app/inventory /app/artifacts /app/tmp \
    && chown -R appuser:appuser /app

WORKDIR /app

# Copy compiled wheels and install
COPY --from=backend-builder /app/wheels /wheels
RUN pip install --no-cache /wheels/* \
    && rm -rf /wheels

# Pre-install all ansible-lockdown CIS roles
# All roles run in --check mode only — nothing is changed on remote hosts
RUN mkdir -p /etc/ansible/roles && \
    ansible-galaxy role install \
        git+https://github.com/ansible-lockdown/RHEL9-CIS.git,main \
        --roles-path /etc/ansible/roles && \
    ansible-galaxy role install \
        git+https://github.com/ansible-lockdown/RHEL8-CIS.git,main \
        --roles-path /etc/ansible/roles && \
    ansible-galaxy role install \
        git+https://github.com/ansible-lockdown/UBUNTU20-CIS.git,main \
        --roles-path /etc/ansible/roles && \
    ansible-galaxy role install \
        git+https://github.com/ansible-lockdown/UBUNTU22-CIS.git,main \
        --roles-path /etc/ansible/roles && \
    ansible-galaxy role install \
        git+https://github.com/ansible-lockdown/UBUNTU24-CIS.git,main \
        --roles-path /etc/ansible/roles && \
    ansible-galaxy role install \
        git+https://github.com/ansible-lockdown/DEBIAN12-CIS.git,main \
        --roles-path /etc/ansible/roles && \
    chmod -R a+r /etc/ansible/roles

# Copy application source
COPY --chown=appuser:appuser . .

# Copy React build output from Stage 1
COPY --chown=appuser:appuser --from=frontend /app/dist ./dist

# Switch to non-root user for runtime
USER appuser

CMD ["sh", "-c", "python3 init_db.py && uvicorn main:app --host 0.0.0.0 --port 8000"]
