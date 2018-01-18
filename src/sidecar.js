'use strict'

const Uuid = require('uuid4')
const Moment = require('moment')
const EventEmitter = require('events')
const Logger = require('@mojaloop/central-services-shared').Logger
const Keys = require('./keys')
const SocketListener = require('./socket')
const KmsConnection = require('./kms')
const HealthCheck = require('./health-check')
const EventService = require('./domain/event')
const BatchService = require('./domain/batch')
const BatchTracker = require('./domain/batch/tracker')
const SidecarService = require('./domain/sidecar')
const Hapi = require('hapi')

class Sidecar extends EventEmitter {
  constructor (settings) {
    super()

    this._initialize()

    this.port = settings.port
    this.service = settings.serviceName
    this.version = settings.version

    this._keyStore = Keys.create()

    this._kmsConnection = KmsConnection.create(settings.kms)
    this._kmsConnection.on('inquiry', this._onKmsInquiry.bind(this))
    this._kmsConnection.on('healthCheck', this._onKmsHealthCheck.bind(this))
    this._kmsConnection.on('connectionClose', this._onKmsConnectionClose.bind(this))

    this._socketListener = SocketListener.create()
    this._socketListener.on('message', this._onSocketMessage.bind(this))

    this._batchTracker = BatchTracker.create(settings)
    this._batchTracker.on('batchReady', this._onBatchReady.bind(this))
  }

  start () {
    return this._saveSidecar()
      .then(() => this._connectToKms())
      .then(() => this._socketListener.listen(this.port))
      .then(() => this._startHealthCheck())
  }

  stop () {
    this._kmsConnection.close()
    this._socketListener.close()
    this.emit('close')
  }

  _initialize () {
    this.id = Uuid()
    this.startTime = Moment.utc()
    this._sequence = 0
  }

  _startHealthCheck () {
    const server = new Hapi.Server()
    server.connection({
      port: 6789
    })
    Logger.info('starting server')
    server.route({
      method: 'GET',
      path: '/health',
      handler: function (request, reply) {
        return reply({ status: 'OK' })
      }
    })
    server.start()
  }

  _saveSidecar () {
    return SidecarService.create(this.id, this.service, this.version, this.startTime)
  }

  _connectToKms () {
    return this._kmsConnection.connect()
      .then(() => this._kmsConnection.register(this.id, this.service))
      .then(keys => this._keyStore.store(keys))
  }

  _reconnectToKms () {
    this._initialize()

    return this._socketListener.pause()
      .then(() => this._saveSidecar())
      .then(() => this._connectToKms())
      .then(() => this._socketListener.resume())
  }

  _onKmsInquiry (request) {
    Logger.info(`Received inquiry ${request.inquiryId} from KMS`)
    BatchService
      .findForService(this.service, request.startTime, request.endTime)
      .then(results => {
        this._kmsConnection.respondToInquiry(request, results)
        Logger.info(`Sent ${results.length} batches to KMS for inquiry ${request.inquiryId}`)
      })
  }

  _onKmsHealthCheck (request) {
    Logger.info(`Received ${request.level} health check request ${request.id} from KMS`)
    if (request.level === 'ping') {
      HealthCheck
        .ping(this)
        .then(hc => {
          this._kmsConnection.respondToHealthCheck(request, hc)
          Logger.info(`Sent health check response ${request.id} successfully to KMS`)
        })
    }
  }

  _onKmsConnectionClose (canReconnect) {
    if (canReconnect) {
      Logger.info('KMS connection closed, attempting to reconnect')
      this._reconnectToKms()
        .then(() => Logger.info(`Successfully reconnected to KMS as id ${this.id}`))
        .catch(err => {
          Logger.error('Error reconnecting to KMS, stopping sidecar', err)
          this.stop()
        })
    } else {
      Logger.error('KMS connection closed with no reconnection, stopping sidecar')
      this.stop()
    }
  }

  _onSocketMessage (message) {
    this._sequence += 1

    EventService.create(this.id, this._sequence, message, this._keyStore.getRowKey())
      .then(event => {
        Logger.info(`Created event ${event.eventId} with sequence ${event.sequence}`)
        this._batchTracker.eventCreated(event.eventId)
      })
  }

  _onBatchReady (eventIds) {
    BatchService
      .create(this.id, eventIds, this._keyStore.getBatchKey())
      .then(batch => this._kmsConnection.sendBatch(batch))
      .then(result => Logger.info(`Sent batch ${result.id} successfully to KMS`))
      .catch(e => Logger.error('Error while creating batch and sending to KMS', e))
  }
}

exports.create = (settings) => {
  return new Sidecar(settings)
}
