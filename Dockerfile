FROM node:18.16.0-alpine AS builder
WORKDIR /home/node/app
RUN chown node: ./
USER node
ENV NODE_ENV production

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY public ./public
COPY src ./src
COPY serve.json tsconfig.json ./

ENV GENERATE_SOURCEMAP false
RUN npm run build

FROM node:18.16.0-alpine
WORKDIR /home/node/app
RUN chown node: ./
USER node
ENV NODE_ENV production

# we should probably not use serve for production
RUN npm install --no-save serve@14.2.0

COPY --from=builder /home/node/app/build ./build
COPY --from=builder /home/node/app/serve.json ./

EXPOSE 3000
CMD ["./node_modules/serve/build/main.js", "-p", "3000"]
