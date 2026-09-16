FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV HOST=0.0.0.0 OPEN_BROWSER=false AUTH_CONSOLE=true
COPY package*.json ./
RUN npm ci --omit=dev
COPY --chown=node:node . .
RUN mkdir -p /app/auth /app/data && chown -R node:node /app/auth /app/data
USER node
EXPOSE 3000
CMD ["npm", "start"]
