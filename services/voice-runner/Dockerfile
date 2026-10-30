FROM node:22.22.3-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY *.mjs ./
USER node
EXPOSE 8080
CMD ["node","main.mjs"]
