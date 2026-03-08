# Stage 1 — build React
FROM node:20-alpine AS frontend
WORKDIR /app
COPY patch-scan-ui/package*.json ./
RUN npm install
COPY patch-scan-ui/ ./
RUN npm run build

# Stage 2 — Python/FastAPI
FROM python:3.10-slim

RUN apt-get update && apt-get install -y \
    sshpass \
    curl \
    openssh-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# copy React build from stage 1
COPY --from=frontend /app/dist ./dist

# init db tables then start fastapi
CMD ["sh", "-c", "python3 init_db.py && uvicorn main:app --host 0.0.0.0 --port 8000"]