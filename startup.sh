#!/bin/sh

KEEP_ALIVE_TIMEOUT="${KEEP_ALIVE_TIMEOUT:-61000}"

exec npm start -- --keepAliveTimeout $KEEP_ALIVE_TIMEOUT