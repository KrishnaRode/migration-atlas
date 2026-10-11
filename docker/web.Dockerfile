FROM node:22-alpine AS build
WORKDIR /web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY apps/web ./
ARG NEXT_PUBLIC_API_URL=http://localhost:8014
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npx next build

FROM node:22-alpine
WORKDIR /web
COPY --from=build /web ./
EXPOSE 3014
CMD ["npx", "next", "start", "-p", "3014"]
