FROM node:20-alpine AS builder

WORKDIR /app

COPY client/package.json /app/package.json

RUN npm install

COPY client /app

ARG VITE_API_BASE=/api/v1
ARG VITE_WS_BASE=
ARG VITE_MINIO_PUBLIC_URL=

ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_WS_BASE=$VITE_WS_BASE
ENV VITE_MINIO_PUBLIC_URL=$VITE_MINIO_PUBLIC_URL

RUN npm run build

FROM nginx:1.27-alpine

COPY deploy/app/nginx.frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
