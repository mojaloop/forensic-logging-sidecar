'use strict'

const Logger = require('@mojaloop/central-services-shared').Logger
const Sidecar = require('./sidecar')
const Db = require('./lib/db')
const Config = require('./lib/config')
const Migrator = require('./lib/migrator')
const Package = require('../package')

const startSidecar = () => {
  const sidecar = Sidecar.create(buildSidecarSettings())
  sidecar.on('close', () => {
    cleanup()
    throw new Error('Sidecar connection has closed, stopping server')
  })

  return Migrator.migrate()
    .then(() => Db.connect(Config.DATABASE_URI))
    .then(() => sidecar.start())
    .then(() => Logger.info(`Sidecar ${sidecar.id} for ${sidecar.service} connected to KMS and listening for messages on port ${sidecar.port}`))
    .catch(err => {
      Logger.error('Fatal error thrown by sidecar', err)
      cleanup()
      throw err
    })
}

const buildSidecarSettings = () => {
  return {
    port: Config.PORT,
    healthPort: Config.HEALTH_PORT,
    serviceName: Config.SERVICE,
    batchSize: Config.BATCH_SIZE,
    batchTimeInterval: Config.BATCH_TIME_INTERVAL,
    version: Package.version,
    kms: {
      url: Config.KMS.URL,
      pingInterval: Config.KMS.PING_INTERVAL,
      requestTimeout: Config.KMS.REQUEST_TIMEOUT,
      connectTimeout: Config.KMS.CONNECT_TIMEOUT,
      reconnectInterval: Config.KMS.RECONNECT_INTERVAL
    }
  }
}

const cleanup = () => {
  Db.disconnect()
}

module.exports = startSidecar()
