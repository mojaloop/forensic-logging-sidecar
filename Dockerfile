FROM mhart/alpine-node:6.5.0
USER root

WORKDIR /opt/sidecar
COPY src /opt/sidecar/src
COPY migrations /opt/sidecar/migrations
COPY config /opt/sidecar/config
COPY package.json .npmrc server.sh /opt/sidecar/

RUN apk add --no-cache make gcc g++ python && \
    apk add -U iproute2 && ln -s /usr/lib/tc /lib/tc && \
    apk add -U iptables && \
    chmod +x /opt/sidecar/server.sh &&\
    npm install --production

EXPOSE 5678

ENTRYPOINT ["/opt/sidecar/server.sh"]
