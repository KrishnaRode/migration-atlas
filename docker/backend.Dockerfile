FROM python:3.12-slim
WORKDIR /app
COPY apps/backend/pyproject.toml apps/backend/
COPY apps/backend/atlas apps/backend/atlas
RUN pip install --no-cache-dir -e apps/backend
COPY ontology ontology
COPY patterns patterns
COPY knowledge knowledge
COPY sample-estates sample-estates
ENV ATLAS_DATA_DIR=/data OLLAMA_BASE_URL=http://host.docker.internal:11434
EXPOSE 8014
CMD ["python", "-m", "uvicorn", "atlas.main:app", "--app-dir", "apps/backend", "--host", "0.0.0.0", "--port", "8014"]
