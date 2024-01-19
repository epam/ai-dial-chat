#!/bin/sh

KEEP_ALIVE_TIMEOUT="${KEEP_ALIVE_TIMEOUT:-5000}"

echo KEEP_ALIVE_TIMEOUT

exec npm start -- --keepAliveTimeout $KEEP_ALIVE_TIMEOUT
