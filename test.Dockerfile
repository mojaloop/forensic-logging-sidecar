FROM mhart/alpine-node:6.5.0
USER root

WORKDIR /opt/sidecar
# COPY . /opt/sidecar
COPY src /opt/sidecar/src
COPY test /opt/sidecar/test
COPY migrations /opt/sidecar/migrations
COPY config /opt/sidecar/config
COPY package.json server.sh /opt/sidecar/

RUN apk add --no-cache make gcc g++ python && \
    apk add -U iproute2 && ln -s /usr/lib/tc /lib/tc && \
    apk add -U iptables && \
    chmod +x /opt/sidecar/server.sh && \
    npm install && \
    npm install -g tape && \
    npm install -g tap-xunit

EXPOSE 5678

CMD ["/opt/sidecar/server.sh"]
