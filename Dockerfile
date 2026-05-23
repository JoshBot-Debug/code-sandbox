FROM node:22-alpine

RUN apk add --no-cache g++ bash && \
    rm -rf /var/cache/apk/*

# Non-root user for the server
RUN addgroup -S executor && adduser -S executor -G executor

WORKDIR /app
COPY server.js .

RUN mkdir -p /tmp && chmod 1777 /tmp

USER executor

EXPOSE 2000

CMD ["node", "server.js"]