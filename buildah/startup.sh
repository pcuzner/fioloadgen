#!/bin/sh

server() {
  echo "Starting server"
  fio --server
}

client() {
  echo "client mode - ready for shell access"
  tail -f /dev/null
}

if [ -z "$FIOMODE" ]; then 
  server
else
  if [ "$FIOMODE" == "server" ]; then 
    server
  else
    client
  fi
fi

