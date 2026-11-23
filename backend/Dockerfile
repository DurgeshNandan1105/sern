# SERN Backend Production Container
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for GIS and geospatial libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy ML model artifacts and backend source
COPY AccidentDetectionML/models /app/AccidentDetectionML/models
COPY backend /app/backend

WORKDIR /app/backend

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
