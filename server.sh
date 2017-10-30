#!/bin/sh

iptables -F \
&& iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT \
&& iptables -I INPUT -p tcp --dport 5678 -j ACCEPT \
&& iptables -A INPUT -j DROP

cd /opt/sidecar/
node src/server.js
