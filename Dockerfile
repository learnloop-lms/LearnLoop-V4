# Learn Loop - Adaptive Gamified Learning Management System
# Production Application Container

FROM python:3.10-slim

# Install system dependencies (compilers for LMS coding tasks, curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application directories and assets
COPY backend ./backend
COPY models ./models
COPY assets ./assets
COPY frontend/dist ./frontend/dist
COPY database_schema.sql ./
COPY README.md ./

# Sync any built assets into assets directory
RUN if [ -d "./frontend/dist/assets" ]; then cp -rn ./frontend/dist/assets/* ./assets/ 2>/dev/null || true; fi

# Environment configuration
ENV PYTHONUNBUFFERED=1 \
    DATABASE_URL="sqlite:///./learn_loop.db" \
    SECRET_KEY="learn_loop_super_secret_jwt_key_2026_scholar_research" \
    PORT=8000

# Expose backend and frontend port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/ || exit 1

WORKDIR /app/backend

# Start FastAPI application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
