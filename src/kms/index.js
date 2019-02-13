'use strict'

const P = require('bluebird')
const Uuid = require('uuid4')
const EventEmitter = require('events')
const Logger = require('@mojaloop/central-services-shared').Logger
const Requests = require('./requests')
const WebSocket = require('./websocket')
const Errors = require('../errors')
const SymmetricCrypto = require('../crypto/symmetric')
const AsymmetricCrypto = require('../crypto/asymmetric')

class KmsConnection extends EventEmitter {
  constructor (settings) {
    super()

    const url = settings.url || 'ws://localhost:8080/sidecar'
    const pingInterval = settings.pingInterval || 30000
    const requestTimeout = settings.requestTimeout || 5000
    const connectTimeout = settings.connectTimeout || 60000
    const reconnectInterval = settings.reconnectInterval || 5000

    this._ws = WebSocket.create({ url, pingInterval, connectTimeout, reconnectInterval })
    this._pendingRequests = Requests.create({ timeout: requestTimeout })
  }

  connect () {
    return new P((resolve, reject) => {
      if (this._ws.isConnected()) {
        return resolve(this)
      }

      this._ws.removeAllListeners()

      const connectErrorListener = (err) => {
        Logger.error('Error while connecting to KMS', err)
        this._ws.removeAllListeners()
        reject(err)
      }

      this._ws.once('error', connectErrorListener)

      this._ws.once('open', () => {
        // Remove listener only used for connect problems.
        this._ws.removeListener('error', connectErrorListener)

        this._ws.on('close', this._onWebSocketClose.bind(this))
        this._ws.on('error', this._onWebSocketError.bind(this))
        this._ws.on('message', this._onWebSocketMessage.bind(this))

        resolve(this)
      })

      this._ws.connect()
    })
  }

  close () {
    this._ws.close()
  }

  register (sidecarId, serviceName) {
    return P.try(() => {
      if (!this._ws.isConnected()) {
        throw new Error('You must connect before registering')
      }

      return this.request('register', { id: sidecarId, serviceName })
        .then(registerResponse => {
          const rowKey = registerResponse.rowKey
          const batchKey = registerResponse.batchKey
          const challenge = registerResponse.challenge

          // Send challenge request to KMS.
          const rowSignature = SymmetricCrypto.sign(challenge, rowKey)
          const batchSignature = AsymmetricCrypto.sign(challenge, batchKey)

          return this.request('challenge', { rowSignature, batchSignature })
            .then(challengeResponse => {
              if (challengeResponse.status.toUpperCase() !== 'OK') {
                return P.reject(new Errors.KmsRegistrationError(`Received invalid status from KMS during challenge: ${challengeResponse.status}`))
              }

              return { batchKey, rowKey }
            })
        })
    })
  }

  respondToHealthCheck (request, hcResult) {
    this.respond(request.id, hcResult)
  }

  respondToInquiry (request, inquiryResults) {
    const method = 'inquiry-response'
    const total = inquiryResults.length

    if (total > 0) {
      let item = 0

      inquiryResults.forEach(b => {
        item += 1
        Logger.info(`Sending batch ${b.batchId} for inquiry ${request.inquiryId}, item ${item} of total ${total}`)
        this._send({ method, params: { inquiry: request.inquiryId, id: b.batchId, body: b.data, total, item } })
      })
    } else {
      this._send({ method, params: { inquiry: request.inquiryId, total: 0, item: 0 } })
    }
  }

  sendBatch (batch) {
    return this.request('batch', { 'id': batch.batchId, 'signature': batch.signature })
  }

  request (method, params) {
    return this._pendingRequests.start(id => {
      this._send({ id, method, params })
    })
      .then(response => {
        if (response.error) {
          return P.reject(new Errors.KmsResponseError(response.error.id, response.error.message))
        }
        return response.result
      })
  }

  respond (requestId, result) {
    this._ws.send(this._buildJsonRpcMessage(requestId, { result }))
  }

  respondError (requestId, error) {
    this._ws.send(this._buildJsonRpcMessage(requestId, { error }))
  }

  _send ({ id, method, params }) {
    if (!id) {
      id = Uuid()
    }
    this._ws.send(this._buildJsonRpcMessage(id, { method, params }))
  }

  _isJsonRpc (data) {
    return data.jsonrpc && data.jsonrpc === '2.0'
  }

  _isJsonRpcRequest (data) {
    return this._isJsonRpc(data) && data.method
  }

  _buildJsonRpcMessage (id, data) {
    data['id'] = id
    data['jsonrpc'] = '2.0'
    return JSON.stringify(data)
  }

  // Websocket event handlers
  _onWebSocketMessage (data) {
    let parsed = JSON.parse(data)

    if (this._isJsonRpc(parsed)) {
      let id = parsed.id

      if (this._isJsonRpcRequest(parsed)) {
        // This is a request from the KMS, emit the appropriate event.
        switch (parsed.method.toLowerCase()) {
          case 'healthcheck':
            this.emit('healthCheck', { id, level: parsed.params.level })
            break
          case 'inquiry':
            this.emit('inquiry', { id, inquiryId: parsed.params.inquiry, startTime: parsed.params.startTime, endTime: parsed.params.endTime })
            break
          default:
            Logger.warn(`Unhandled request from KMS received: ${data}`)
        }
      } else {
        if (this._pendingRequests.exists(id)) {
          // This is a response to a pending request, resolve with the parsed response.
          this._pendingRequests.complete(id, { result: parsed.result, error: parsed.error })
        } else {
          Logger.warn(`Unknown response sent for id ${id}: ${data}`)
        }
      }
    } else {
      Logger.warn(`Invalid message format received from KMS: ${data}`)
    }
  }

  _onWebSocketError (err) {
    Logger.error('Error on WebSocket connection', err)

    const canReconnect = (err.code === 'ECONNREFUSED')
    this.emit('connectionClose', canReconnect)
  }

  _onWebSocketClose (code, reason) {
    Logger.error(`WebSocket connection closed: ${code} - ${reason}`)

    const canReconnect = (code !== 1000)
    this.emit('connectionClose', canReconnect)
  }
}

exports.create = (settings) => {
  return new KmsConnection(settings || {})
}
