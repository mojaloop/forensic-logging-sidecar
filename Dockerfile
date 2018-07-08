FROM mhart/alpine-node:8.9.4
USER root

WORKDIR /opt/sidecar
COPY src /opt/sidecar/src
COPY migrations /opt/sidecar/migrations
COPY config /opt/sidecar/config
COPY package.json server.sh /opt/sidecar/

RUN apk add --no-cache make gcc g++ python && \
    apk add -U iproute2 && ln -s /usr/lib/tc /lib/tc && \
    apk add -U iptables && \
    chmod +x /opt/sidecar/server.sh &&\
    npm install --production

EXPOSE 5678
EXPOSE 6789

CMD ["/opt/sidecar/server.sh"]
