FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
ARG VITE_MEDIA_URL
ENV VITE_MEDIA_URL=$VITE_MEDIA_URL
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ .
COPY --from=web /web/dist ./public-app
RUN mkdir -p storage public/temp && chown -R node:node /app
USER node
ENV NODE_ENV=production
EXPOSE 8000
CMD ["node", "src/index.js"]
