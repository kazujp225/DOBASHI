# Multi-stage build for frontend + backend

# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend
FROM python:3.11-slim
WORKDIR /app

# Install dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./

# Copy frontend build from stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend_dist

# Create necessary directories
RUN mkdir -p data logs static

# Expose port (Render uses PORT env var)
EXPOSE 10000

# Start command using shell to expand $PORT
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}
