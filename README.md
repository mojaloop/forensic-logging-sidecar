# Forensic Logging Sidecar

[![Git Commit](https://img.shields.io/github/last-commit/mojaloop/forensic-logging-sidecar.svg?style=flat)](https://github.com/mojaloop/forensic-logging-sidecar/commits/master)
[![Git Releases](https://img.shields.io/github/release/mojaloop/forensic-logging-sidecar.svg?style=flat)](https://github.com/mojaloop/forensic-logging-sidecar/releases)
[![Docker pulls](https://img.shields.io/docker/pulls/mojaloop/forensic-logging-sidecar.svg?style=flat)](https://hub.docker.com/r/mojaloop/forensic-logging-sidecar)
[![CircleCI](https://circleci.com/gh/mojaloop/forensic-logging-sidecar.svg?style=svg)](https://circleci.com/gh/mojaloop/forensic-logging-sidecar)


The sidecar is a service that acts as an intermediary to facilitate messaging between the services and central kms, including the following functions:

- Relaying a batch of events/messages from the connected services to the central kms
- Performing a health check on the sidecar

The following documentation represents the services and endpoints responsible for various sidecar functions.

Contents:

- [Deployment](#deployment)
- [Configuration](#configuration)
- [Connect And Write](#connect-and-write)
- [Logging](#logging)
- [Tests](#tests)

## Deployment

### Deploy to Docker

To deploy the sidecar with a service in a Docker container, create a Docker compose file at the root level of the service and add the following as its content:
```
version: '2'
services:
  central-ledger:
    build:
      context: ./
      dockerfile: api.Dockerfile
    environment:
      CLEDG_DATABASE_URI: "postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/central_ledger"
      CLEDG_SIDECAR__HOST: "forensic-logging-sidecar"
    networks:
      - sidecar
    depends_on:
      - postgres
      - forensic-logging-sidecar
  central-ledger-admin:
    build:
      context: ./
      dockerfile: admin.Dockerfile
    environment:
      CLEDG_DATABASE_URI: "postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/central_ledger"
      CLEDG_SIDECAR__HOST: "forensic-logging-sidecar"
    networks:
      - sidecar
    depends_on:
      - postgres
      - forensic-logging-sidecar
  forensic-logging-sidecar:
    env_file: .env
    environment:
      SIDE_DATABASE_URI: "postgres://${SIDE_POSTGRES_USER}:${SIDE_POSTGRES_PASSWORD}@postgres:5432/sidecar"
      SIDE_KMS__URL: "ws://kms:8080/sidecar"
    image: modusbox-level1-docker-release.jfrog.io/@mojaloop/forensic-logging-sidecar:latest
    depends_on:
      - postgres
      - kms
    networks:
      - back
      - sidecar
  kms:
    env_file: .env
    image:  modusbox-level1-docker-release.jfrog.io/@mojaloop/central-kms:latest
    depends_on:
      - postgres
    networks:
      - back
networks:
  sidecar: {}
```

### Deploy to ECS

To deploy the sidecar with a service to ECS, make sure you've created an account on AWS and use this as an example for deploying the service and sidecar to ECS:
```
'use strict'

const AWS = require('aws-sdk')
const ecs = new AWS.ECS()
const Variables = require('./variables')

const registerTaskDefinition = (name, service, image, port, environment = []) => {
  const params = {
    containerDefinitions: [
      {
        name,
        image,
        essential: true,
        memoryReservation: 200,
        portMappings: [
          {
            containerPort: port
          }
        ],
        links: [
          `${Variables.SIDECAR.NAME}:${Variables.SIDECAR.NAME}`
        ],
        environment,
        logConfiguration: {
          logDriver: 'syslog',
          options: {
            'syslog-address': 'tcp://127.0.0.1:514',
            'syslog-facility': 'daemon',
            'tag': 'central-ledger'
          }
        }
      },
      {
        name: Variables.SIDECAR.NAME,
        image: `${Variables.AWS_ACCOUNT_ID}.dkr.ecr.${Variables.AWS_REGION}.amazonaws.com/${Variables.SIDECAR.IMAGE}:latest`,
        essential: true,
        memoryReservation: 200,
        portMappings: [
          {
            containerPort: Variables.SIDECAR.PORT
          }
        ],
        environment: [
          {
            name: 'SIDE_SERVICE',
            value: service
          },
          {
            name: 'SIDE_DATABASE_URI',
            value: `postgres://${Variables.SIDECAR.POSTGRES_USER}:${Variables.SIDECAR.POSTGRES_PASSWORD}@${Variables.SIDECAR.POSTGRES_HOST}:5432/sidecar`
          },
          {
            name: 'SIDE_KMS__URL',
            value: Variables.SIDECAR.KMS_URL
          }
        ]
      }
    ],
    family: name
  }

  return ecs.registerTaskDefinition(params).promise()
    .then(result => {
      const revision = result.taskDefinition.taskDefinitionArn
      console.log(`Registered task definition: ${revision}`)
      return revision
    })
}

const deployService = (clusterName, service, taskDefinition) => {
  const params = {
    service,
    taskDefinition,
    cluster: clusterName,
    desiredCount: 1
  }

  console.log(`Deploying ${taskDefinition} to ${service} on cluster ${clusterName}`)

  return ecs.updateService(params).promise()
    .then(result => result.service.taskDefinition)
}

module.exports = {
  registerTaskDefinition,
  deployService
}
```

***For more guidance on deployment to ECR, look in the deploy folder at the root of the project.***

## Configuration

### Environment variables
The Sidecar has a handful of options that can be configured through environment variables.

| Environment variable | Description | Example values |
| -------------------- | ----------- | ------ |
| SIDE\_DATABASE\_URI | The connection string for the database the sidecar will use. Postgres is currently the only supported database. | postgres://\<username>:\<password>@localhost:5678/forensic_logging_sidecar |
| SIDE\_SERVICE | The name for the sidecar service. | TestService |
| SIDE\_BATCH\_SIZE | The message batch size. | 64 |
| SIDE\_PORT | The port the sidecar server will run on. | 5678 |
| SIDE\_KMS\__URL | The url for the KMS | ws://localhost:8080/sidecar |
| SIDE\_KMS\__PING_INTERVAL | The time, in milliseconds, between pings to the KMS |  30000 |
| SIDE\_KMS\__REQUEST_TIMEOUT | The time, in milliseconds, to timeout a request to the KMS | 30000 |
| SIDE\_KMS\__CONNECT_TIMEOUT | The time, in milliseconds, to timeout a connection attempt to the KMS | 60000  |
| SIDE\_KMS\__RECONNECT_INTERVAL | The time, in milliseconds, between connection attempts to the KMS | 5000 |

## Connect And Write
For our examples we've written client.js which extends EventEmitter to connect and write to the sidecar.

Once the sidecar has launched, your client should connect to it using the exposed port.
```
  connect (port) {
    this._client = Net.createConnection({ port }, () => {
      this.emit('open')
    })

    this._client.on('data', data => {
      this.emit('data', data)
    })

    this._client.on('end', () => this.emit('end'))
  }
```

After connecting to the sidecar, the client can write to it. 

*The message should be prefixed with the length of the message written as a big endian. The length should be a valid unsigned 32-bit integer*

```
  write (msg) {
    let message = Buffer.isBuffer(msg) ? msg : Buffer.from(msg)
    let length = message.length

    let buffer = Buffer.alloc(this._prefixSize + length)
    buffer.writeUInt32BE(length, 0)
    message.copy(buffer, this._prefixSize)
    this._client.write(buffer)
  }
```
***For a more complete example, look in the examples folder at the root of the project.***

## Logging

Logs are sent to standard output by default.

## Tests

Tests include unit and functional.

Running the tests:


    npm run test:all


Tests include code coverage via istanbul. See the test/ folder for testing scripts.
