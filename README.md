# Gantt Websocket server

## Intro

Server component for the Gantt Websockets demo. It includes no backend storage, initial
data is loaded from `data/launch-saas.json` and served to client on request.

Clients connect to the server and send their updates which get propagated to other 
clients connected to the same server

## Usage

This will launch server on default port 8080

```shell
$ npm install
$ npm run start
```

If you want to specify different port you can call server script directly:

```shell
$ node server.js port=8090
```
