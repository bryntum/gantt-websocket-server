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

## Authentication and Authorization

Server supports basic auth. Login procedure is permissive, by default anyone can log in using arbitrary
username. There are some reserved logins declared in `src/server/AuthorizationHandler.js` including plain
text passwords.

Authorization is based on user groups. Each group has a list of project ids members of that group have
access to. Anonymous users have access to the default project. Authorized users have complete access to
the project.

### Login

After opening websocket connection client should send a login command:

```json
{ "command": "login", "login" : "user", "password" : "password" }
```

If authorization is successful client will receive a following message:

```json
{ "command": "login" }
```

If username or password is incorrect error is returned to the client:

```json
{ "command": "login", "error": "Wrong username/password" }
```

If client is not logged in an is trying to access the project data or send updates sever will prevent it
responding with the following message:

```json
{ "command": "dataset", "error": "Authentication required" }
```

### List available projects

After successful login client can check list of available projects using the following command:

```json
{ "command": "projects" }
```

Response will contain list of project ids client is authorized to access:

```json
{ "command": "projects", "projects": [1,2] }
```

### Load project

To start working with a project client should set a `dataset` command specifying id of the project:

```json
{ "command": "dataset", "project": 1 }
```

Response will contain complete dataset of the project:

```json
{ "command": "dataset", "project": 1, "dataset": {} }
```

This command will subscribe client to project updates. When another client changes the same project current
client would receive a notification message:

```json
{ "command": "projectChange", "project": 1, "changes": {} }
```

Client will not receive updates for other modified projects. Project can be switched using the `dataset`
command.

If client is not authorized to access the project server will respond with the following message:

```json
{ "command": "dataset", "error": "Authorization required" }
```

### Logout

To stop receiving updates client can either close the websocket connection or send a `logout` command:

```json
{ "command": "logout" }
```

If command is sent server will return it back confirming logout. It will also notify other clients about
current list of users and about specific user logging out:

```json
{ "command": "logout", "userName": "user" }
```
