#!/bin/sh

iptables -F \
&& iptables -A INPUT -p tcp --dport 5678 -j ACCEPT \
&& iptables -A INPUT -p tcp --dport 6789 -j ACCEPT \
&& iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT \
&& iptables -A INPUT -j DROP

cd /opt/sidecar/
node src/server.js
