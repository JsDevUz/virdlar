FROM node:20-alpine AS webapp-builder
WORKDIR /app/webapp
COPY webapp/package*.json ./
RUN npm ci
COPY webapp/ .
ARG VITE_ADMIN_IDS
ENV VITE_ADMIN_IDS=$VITE_ADMIN_IDS
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ src/
COPY --from=webapp-builder /app/webapp/dist webapp/dist
RUN mkdir -p data
VOLUME ["/app/data"]
EXPOSE 3000
ENV TZ=Asia/Tashkent
ENV NODE_ENV=production
CMD ["node", "src/api/index.js"]
