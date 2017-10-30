'use strict'

const src = '../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Moment = require('moment')
const EventEmitter = require('events')
const Logger = require('@mojaloop/central-services-shared').Logger
const Requests = require(`${src}/kms/requests`)
const WebSocket = require(`${src}/kms/websocket`)
const Errors = require(`${src}/errors`)
const SymmetricCrypto = require(`${src}/crypto/symmetric`)
const AsymmetricCrypto = require(`${src}/crypto/asymmetric`)
const Proxyquire = require('proxyquire')

Test('KmsConnection', kmsConnTest => {
  let sandbox
  let uuidStub
  let KmsConnection

  kmsConnTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Logger)
    sandbox.stub(Requests, 'create')
    sandbox.stub(WebSocket, 'create')
    sandbox.stub(SymmetricCrypto, 'sign')
    sandbox.stub(AsymmetricCrypto, 'sign')

    uuidStub = sandbox.stub()
    KmsConnection = Proxyquire(`${src}/kms`, { 'uuid4': uuidStub })

    t.end()
  })

  kmsConnTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  kmsConnTest.test('create should', createTest => {
    createTest.test('create new connection and set properties', test => {
      let settings = { url: 'ws://test.com', pingInterval: 5000, requestTimeout: 15000, connectTimeout: 9000, reconnectInterval: 2000 }
      KmsConnection.create(settings)

      test.ok(WebSocket.create.calledWith(sandbox.match({
        url: settings.url,
        pingInterval: settings.pingInterval,
        connectTimeout: settings.connectTimeout,
        reconnectInterval: settings.reconnectInterval
      })))
      test.ok(Requests.create.calledWith(sandbox.match({
        timeout: settings.requestTimeout
      })))
      test.end()
    })

    createTest.test('use default property values', test => {
      KmsConnection.create()

      test.ok(WebSocket.create.calledWith(sandbox.match({
        url: 'ws://localhost:8080/sidecar',
        pingInterval: 30000,
        connectTimeout: 60000,
        reconnectInterval: 5000
      })))
      test.ok(Requests.create.calledWith(sandbox.match({
        timeout: 5000
      })))

      test.end()
    })

    createTest.end()
  })

  kmsConnTest.test('connect should', connectTest => {
    connectTest.test('connect to websocket and resolve when open', test => {
      let wsEmitter = new EventEmitter()
      wsEmitter.connect = sandbox.stub()
      wsEmitter.isConnected = sandbox.stub().returns(false)
      WebSocket.create.returns(wsEmitter)

      let settings = { url: 'ws://test.com', pingInterval: 5000 }
      let kmsConnection = KmsConnection.create(settings)

      let connectPromise = kmsConnection.connect()
      test.ok(wsEmitter.connect.calledOnce)
      test.ok(wsEmitter.listenerCount('open'), 1)
      test.ok(wsEmitter.listenerCount('error'), 1)
      test.equal(wsEmitter.listeners('error')[0].name.indexOf('_onWebSocketError'), -1)

      wsEmitter.emit('open')

      connectPromise
        .then(() => {
          test.equal(wsEmitter.listenerCount('open'), 0)
          test.equal(wsEmitter.listenerCount('close'), 1)
          test.equal(wsEmitter.listenerCount('error'), 1)
          test.equal(wsEmitter.listenerCount('message'), 1)
          test.notEqual(wsEmitter.listeners('error')[0].name.indexOf('_onWebSocketError'), -1)
          test.end()
        })
    })

    connectTest.test('reject if error event emitted', test => {
      let wsEmitter = new EventEmitter()
      wsEmitter.connect = sandbox.stub()
      wsEmitter.isConnected = sandbox.stub().returns(false)
      WebSocket.create.returns(wsEmitter)

      let settings = { url: 'ws://test.com' }
      let kmsConnection = KmsConnection.create(settings)

      let connectPromise = kmsConnection.connect()
      test.ok(wsEmitter.connect.calledOnce)
      test.ok(wsEmitter.listenerCount('open'), 1)
      test.ok(wsEmitter.listenerCount('error'), 1)
      test.equal(wsEmitter.listeners('error')[0].name.indexOf('_onWebSocketError'), -1)

      let error = new Error('Error connecting to websocket')
      wsEmitter.emit('error', error)

      connectPromise
        .then(() => {
          test.fail('Should have thrown error')
          test.end()
        })
        .catch(err => {
          test.equal(wsEmitter.listenerCount('open'), 0)
          test.equal(wsEmitter.listenerCount('close'), 0)
          test.equal(wsEmitter.listenerCount('error'), 0)
          test.equal(wsEmitter.listenerCount('message'), 0)
          test.equal(err, error)
          test.end()
        })
    })

    connectTest.test('return immediately if already connected', test => {
      let wsEmitter = new EventEmitter()
      wsEmitter.connect = sandbox.stub()
      wsEmitter.isConnected = sandbox.stub().returns(true)
      WebSocket.create.returns(wsEmitter)

      let kmsConnection = KmsConnection.create()

      kmsConnection.connect()
        .then(() => {
          test.notOk(wsEmitter.connect.calledOnce)
          test.end()
        })
    })

    connectTest.end()
  })

  kmsConnTest.test('close should', closeTest => {
    closeTest.test('call close method on websocket connection', test => {
      let wsEmitter = new EventEmitter()
      wsEmitter.connect = sandbox.stub()
      wsEmitter.isConnected = sandbox.stub().returns(true)
      wsEmitter.close = sandbox.stub()
      WebSocket.create.returns(wsEmitter)

      let kmsConnection = KmsConnection.create()

      kmsConnection.connect()
        .then(() => {
          kmsConnection.close()

          test.ok(wsEmitter.close.calledOnce)
          test.end()
        })
    })

    closeTest.end()
  })

  kmsConnTest.test('register should', registerTest => {
    registerTest.test('reject if not connected', test => {
      let wsEmitter = new EventEmitter()
      wsEmitter.isConnected = sandbox.stub().returns(false)
      WebSocket.create.returns(wsEmitter)

      let conn = KmsConnection.create()

      conn.register('id')
        .then(() => {
          test.fail('Should have thrown error')
          test.end()
        })
        .catch(err => {
          test.equal(err.message, 'You must connect before registering')
          test.end()
        })
    })

    registerTest.test('register with KMS and perform challenge', test => {
      let requestStartStub = sandbox.stub()
      Requests.create.returns({ start: requestStartStub })

      let wsEmitter = new EventEmitter()
      wsEmitter.send = sandbox.stub()
      wsEmitter.isConnected = sandbox.stub().returns(true)
      WebSocket.create.returns(wsEmitter)

      let sidecarId = 'sidecar1'
      let serviceName = 'TestSidecar'

      let registerMessageId = `register-${sidecarId}`
      let registerRequest = { jsonrpc: '2.0', id: registerMessageId, method: 'register', params: { id: sidecarId, serviceName } }
      let registerResponse = { jsonrpc: '2.0', id: registerMessageId, result: { id: sidecarId, batchKey: 'batch-key', rowKey: 'row-key', challenge: 'challenge' } }

      const rowSignature = 'row-signature'
      const batchSignature = 'batch-signature'
      SymmetricCrypto.sign.returns(rowSignature)
      AsymmetricCrypto.sign.returns(batchSignature)

      let challengeMessageId = `challenge-${sidecarId}`
      let challengeRequest = { jsonrpc: '2.0', id: challengeMessageId, method: 'challenge', params: { rowSignature, batchSignature } }
      let challengeResponse = { jsonrpc: '2.0', id: challengeMessageId, result: { status: 'ok' } }

      requestStartStub.onFirstCall().callsArgWith(0, registerMessageId)
      requestStartStub.onFirstCall().returns(P.resolve(registerResponse))

      requestStartStub.onSecondCall().callsArgWith(0, challengeMessageId)
      requestStartStub.onSecondCall().returns(P.resolve(challengeResponse))

      let kmsConnection = KmsConnection.create()

      let registerPromise = kmsConnection.register(sidecarId, serviceName)
      registerPromise
        .then(keys => {
          test.deepEqual(JSON.parse(wsEmitter.send.firstCall.args), registerRequest)
          test.deepEqual(JSON.parse(wsEmitter.send.secondCall.args), challengeRequest)

          test.ok(SymmetricCrypto.sign.calledWith(registerResponse.result.challenge, registerResponse.result.rowKey))
          test.ok(AsymmetricCrypto.sign.calledWith(registerResponse.result.challenge, registerResponse.result.batchKey))

          test.equal(keys.batchKey, registerResponse.result.batchKey)
          test.equal(keys.rowKey, registerResponse.result.rowKey)
          test.end()
        })
    })

    registerTest.test('throw error if KMS sends error during registration', test => {
      let requestStartStub = sandbox.stub()
      Requests.create.returns({ start: requestStartStub })

      let wsEmitter = new EventEmitter()
      wsEmitter.send = sandbox.stub()
      wsEmitter.connect = sandbox.stub()
      wsEmitter.isConnected = sandbox.stub().returns(true)
      WebSocket.create.returns(wsEmitter)

      let sidecarId = 'sidecar1'

      let registerMessageId = `register-${sidecarId}`
      let registerResponse = { jsonrpc: '2.0', id: registerMessageId, error: { id: 101, message: 'bad stuff' } }

      requestStartStub.onFirstCall().callsArgWith(0, registerMessageId)
      requestStartStub.onFirstCall().returns(P.resolve(registerResponse))

      let kmsConnection = KmsConnection.create()

      let registerPromise = kmsConnection.register(sidecarId)
      registerPromise
        .then(() => {
          test.fail('Should have thrown error')
          test.end()
        })
        .catch(Errors.KmsResponseError, err => {
          test.ok(wsEmitter.send.calledOnce)
          test.equal(err.message, registerResponse.error.message)
          test.equal(err.errorId, registerResponse.error.id)
          test.end()
        })
    })

    registerTest.test('throw error if KMS sends error during challenge', test => {
      let requestStartStub = sandbox.stub()
      Requests.create.returns({ start: requestStartStub })

      let wsEmitter = new EventEmitter()
      wsEmitter.send = sandbox.stub()
      wsEmitter.connect = sandbox.stub()
      wsEmitter.isConnected = sandbox.stub().returns(true)
      WebSocket.create.returns(wsEmitter)

      let sidecarId = 'sidecar1'

      let registerMessageId = `register-${sidecarId}`
      let registerResponse = { jsonrpc: '2.0', id: registerMessageId, result: { id: sidecarId, batchKey: 'batch-key', rowKey: 'row-key', challenge: 'challenge' } }

      let challengeMessageId = `challenge-${sidecarId}`
      let challengeResponse = { jsonrpc: '2.0', id: challengeMessageId, error: { id: 105, message: 'bad challenge' } }

      requestStartStub.onFirstCall().callsArgWith(0, registerMessageId)
      requestStartStub.onFirstCall().returns(P.resolve(registerResponse))

      requestStartStub.onSecondCall().callsArgWith(0, challengeMessageId)
      requestStartStub.onSecondCall().returns(P.resolve(challengeResponse))

      let kmsConnection = KmsConnection.create()

      let registerPromise = kmsConnection.register(sidecarId)
      registerPromise
        .then(() => {
          test.fail('Should have thrown error')
          test.end()
        })
        .catch(Errors.KmsResponseError, err => {
          test.equal(err.message, challengeResponse.error.message)
          test.equal(err.errorId, challengeResponse.error.id)
          test.end()
        })
    })

    registerTest.test('throw error if KMS returns invalid status during challenge', test => {
      let requestStartStub = sandbox.stub()
      Requests.create.returns({ start: requestStartStub })

      let wsEmitter = new EventEmitter()
      wsEmitter.send = sandbox.stub()
      wsEmitter.connect = sandbox.stub()
      wsEmitter.isConnected = sandbox.stub().returns(true)
      WebSocket.create.returns(wsEmitter)

      let sidecarId = 'sidecar1'

      let registerMessageId = `register-${sidecarId}`
      let registerResponse = { jsonrpc: '2.0', id: registerMessageId, result: { id: sidecarId, batchKey: 'batch-key', rowKey: 'row-key', challenge: 'challenge' } }

      let challengeMessageId = `challenge-${sidecarId}`
      let challengeResponse = { jsonrpc: '2.0', id: challengeMessageId, result: { status: 'nope' } }

      requestStartStub.onFirstCall().callsArgWith(0, registerMessageId)
      requestStartStub.onFirstCall().returns(P.resolve(registerResponse))

      requestStartStub.onSecondCall().callsArgWith(0, challengeMessageId)
      requestStartStub.onSecondCall().returns(P.resolve(challengeResponse))

      let kmsConnection = KmsConnection.create()

      let registerPromise = kmsConnection.register(sidecarId)
      registerPromise
        .then(() => {
          test.fail('Should have thrown error')
          test.end()
        })
        .catch(Errors.KmsRegistrationError, err => {
          test.equal(err.message, `Received invalid status from KMS during challenge: ${challengeResponse.result.status}`)
          test.end()
        })
    })

    registerTest.end()
  })

  kmsConnTest.test('respondToHealthCheck should', respondHcTest => {
    respondHcTest.test('send healthcheck response from request', test => {
      let id = 'request-id'
      let request = { id }
      let healthCheck = {}
      let jsonRpcResponse = { jsonrpc: '2.0', id, result: healthCheck }

      let ws = { send: sandbox.stub() }

      let conn = KmsConnection.create()
      conn._ws = ws

      conn.respondToHealthCheck(request, healthCheck)
      test.ok(ws.send.calledOnce)
      test.deepEqual(JSON.parse(ws.send.firstCall.args), jsonRpcResponse)
      test.end()
    })

    respondHcTest.end()
  })

  kmsConnTest.test('respondToInquiry should', respondInquiryTest => {
    respondInquiryTest.test('send inquiry response to KMS for each found batch', test => {
      let method = 'inquiry-response'
      let inquiryId = 'inquiry-id'
      let requestId = 'response-id'
      let requestId2 = 'response-id2'

      uuidStub.onFirstCall().returns(requestId)
      uuidStub.onSecondCall().returns(requestId2)

      let request = { inquiryId }
      let results = [{ batchId: 'batch-id', data: 'this is data' }, { batchId: 'batch-id2', data: 'more data' }]

      let jsonRpcRequest = { jsonrpc: '2.0', id: requestId, method, params: { inquiry: inquiryId, id: results[0].batchId, body: results[0].data, total: 2, item: 1 } }
      let jsonRpcRequest2 = { jsonrpc: '2.0', id: requestId2, method, params: { inquiry: inquiryId, id: results[1].batchId, body: results[1].data, total: 2, item: 2 } }

      let ws = { send: sandbox.stub() }

      let conn = KmsConnection.create()
      conn._ws = ws

      conn.respondToInquiry(request, results)
      test.ok(ws.send.calledTwice)
      test.deepEqual(JSON.parse(ws.send.firstCall.args), jsonRpcRequest)
      test.deepEqual(JSON.parse(ws.send.secondCall.args), jsonRpcRequest2)

      test.end()
    })

    respondInquiryTest.test('send special inquiry response to KMS if no results found', test => {
      let method = 'inquiry-response'
      let inquiryId = 'inquiry-id'
      let requestId = 'response-id'

      uuidStub.onFirstCall().returns(requestId)

      let request = { inquiryId }
      let results = []

      let jsonRpcRequest = { jsonrpc: '2.0', id: requestId, method, params: { inquiry: inquiryId, total: 0, item: 0 } }

      let ws = { send: sandbox.stub() }

      let conn = KmsConnection.create()
      conn._ws = ws

      conn.respondToInquiry(request, results)
      test.ok(ws.send.calledOnce)
      test.deepEqual(JSON.parse(ws.send.firstCall.args), jsonRpcRequest)

      test.end()
    })

    respondInquiryTest.end()
  })

  kmsConnTest.test('sendBatch should', sendBatchTest => {
    sendBatchTest.test('send batch and return pending promise', test => {
      let requestId = 'request'

      let method = 'batch'
      let batch = { batchId: 'batch-id', signature: 'sig' }
      let jsonRpcRequest = { jsonrpc: '2.0', id: requestId, method, params: { id: 'batch-id', signature: 'sig' } }

      let ws = { send: sandbox.stub() }

      let requestStartStub = sandbox.stub()
      Requests.create.returns({ start: requestStartStub })

      let conn = KmsConnection.create()
      conn._ws = ws

      let result = { test: 'test' }

      requestStartStub.onFirstCall().callsArgWith(0, requestId)
      requestStartStub.onFirstCall().returns(P.resolve({ result }))

      let requestPromise = conn.sendBatch(batch)
      requestPromise
        .then(r => {
          test.equal(r, result)
          test.ok(ws.send.calledOnce)
          test.deepEqual(JSON.parse(ws.send.firstCall.args), jsonRpcRequest)

          test.end()
        })
    })

    sendBatchTest.end()
  })

  kmsConnTest.test('request should', requestTest => {
    requestTest.test('send JSONRPC request and return pending promise', test => {
      let requestId = 'request'

      let method = 'test'
      let params = { key: 'val' }
      let jsonRpcRequest = { jsonrpc: '2.0', id: requestId, method, params }

      let ws = { send: sandbox.stub() }

      let requestStartStub = sandbox.stub()
      Requests.create.returns({ start: requestStartStub })

      let conn = KmsConnection.create()
      conn._ws = ws

      let result = { test: 'test' }

      requestStartStub.onFirstCall().callsArgWith(0, requestId)
      requestStartStub.onFirstCall().returns(P.resolve({ result }))

      let requestPromise = conn.request(method, params)
      requestPromise
        .then(r => {
          test.equal(r, result)
          test.ok(ws.send.calledOnce)
          test.deepEqual(JSON.parse(ws.send.firstCall.args), jsonRpcRequest)

          test.end()
        })
    })

    requestTest.end()
  })

  kmsConnTest.test('respond should', sendResponseTest => {
    sendResponseTest.test('send JSONRPC response', test => {
      let id = 'id'
      let result = { key: 'val' }
      let jsonRpcResponse = { jsonrpc: '2.0', id, result }

      let ws = { send: sandbox.stub() }

      let conn = KmsConnection.create()
      conn._ws = ws

      conn.respond(id, result)
      test.ok(ws.send.calledOnce)
      test.deepEqual(JSON.parse(ws.send.firstCall.args), jsonRpcResponse)
      test.end()
    })

    sendResponseTest.end()
  })

  kmsConnTest.test('respondError should', sendErrorResponseTest => {
    sendErrorResponseTest.test('send JSONRPC error response', test => {
      let id = 'id'
      let error = { id: 101, message: 'error happened' }
      let jsonRpcErrorResponse = { jsonrpc: '2.0', id, error }

      let ws = { send: sandbox.stub() }

      let conn = KmsConnection.create()
      conn._ws = ws

      conn.respondError(id, error)
      test.ok(ws.send.calledOnce)
      test.deepEqual(JSON.parse(ws.send.firstCall.args), jsonRpcErrorResponse)
      test.end()
    })

    sendErrorResponseTest.end()
  })

  kmsConnTest.test('receiving WebSocket close event should', closeEventTest => {
    closeEventTest.test('emit connectionClose event with canReconnect false if normal close', test => {
      let connCloseSpy = sandbox.spy()

      let wsEmitter = new EventEmitter()
      wsEmitter.connect = sandbox.stub()
      wsEmitter.isConnected = sandbox.stub().returns(false)
      WebSocket.create.returns(wsEmitter)

      let kmsConnection = KmsConnection.create()
      kmsConnection.on('connectionClose', connCloseSpy)

      let connectPromise = kmsConnection.connect()
      wsEmitter.emit('open')

      connectPromise
        .then(() => {
          let code = 1000
          let reason = 'reason'
          wsEmitter.emit('close', code, reason)

          test.ok(Logger.error.calledWith(`WebSocket connection closed: ${code} - ${reason}`))
          test.ok(connCloseSpy.calledWith(false))
          test.end()
        })
    })

    closeEventTest.test('emit close event with canReconnect true if abnormal close', test => {
      let connCloseSpy = sandbox.spy()

      let wsEmitter = new EventEmitter()
      wsEmitter.connect = sandbox.stub()
      wsEmitter.isConnected = sandbox.stub().returns(false)
      WebSocket.create.returns(wsEmitter)

      let kmsConnection = KmsConnection.create()
      kmsConnection.on('connectionClose', connCloseSpy)

      let connectPromise = kmsConnection.connect()
      wsEmitter.emit('open')

      connectPromise
        .then(() => {
          let code = 1006
          let reason = 'reason'
          wsEmitter.emit('close', code, reason)

          test.ok(Logger.error.calledWith(`WebSocket connection closed: ${code} - ${reason}`))
          test.ok(connCloseSpy.calledWith(true))
          test.end()
        })
    })

    closeEventTest.end()
  })

  kmsConnTest.test('receiving WebSocket error event should', errorEventTest => {
    errorEventTest.test('emit close event with canReconnect true if error code ECONNREFUSED', test => {
      let connCloseSpy = sandbox.spy()

      let wsEmitter = new EventEmitter()
      wsEmitter.connect = sandbox.stub()
      wsEmitter.isConnected = sandbox.stub().returns(false)
      WebSocket.create.returns(wsEmitter)

      let kmsConnection = KmsConnection.create()
      kmsConnection.on('connectionClose', connCloseSpy)

      let connectPromise = kmsConnection.connect()
      wsEmitter.emit('open')

      connectPromise
        .then(() => {
          let err = new Error()
          err.code = 'ECONNREFUSED'
          wsEmitter.emit('error', err)

          test.ok(Logger.error.calledWith('Error on WebSocket connection', err))
          test.ok(connCloseSpy.calledWith(true))
          test.end()
        })
    })

    errorEventTest.test('emit close event with canReconnect false if no error code', test => {
      let connCloseSpy = sandbox.spy()

      let wsEmitter = new EventEmitter()
      wsEmitter.connect = sandbox.stub()
      wsEmitter.isConnected = sandbox.stub().returns(false)
      WebSocket.create.returns(wsEmitter)

      let kmsConnection = KmsConnection.create()
      kmsConnection.on('connectionClose', connCloseSpy)

      let connectPromise = kmsConnection.connect()
      wsEmitter.emit('open')

      connectPromise
        .then(() => {
          let err = new Error()
          wsEmitter.emit('error', err)

          test.ok(Logger.error.calledWith('Error on WebSocket connection', err))
          test.ok(connCloseSpy.calledWith(false))
          test.end()
        })
    })

    errorEventTest.end()
  })

  kmsConnTest.test('receiving WebSocket message event should', messageEventTest => {
    messageEventTest.test('log warning if not JSONRPC message', test => {
      let wsEmitter = new EventEmitter()
      wsEmitter.connect = sandbox.stub()
      wsEmitter.isConnected = sandbox.stub().returns(false)
      WebSocket.create.returns(wsEmitter)

      let kmsConnection = KmsConnection.create()

      let connectPromise = kmsConnection.connect()
      wsEmitter.emit('open')

      connectPromise
        .then(() => {
          let data = JSON.stringify({ id: 'id' })
          wsEmitter.emit('message', data)

          test.ok(Logger.warn.calledWith(`Invalid message format received from KMS: ${data}`))
          test.end()
        })
    })

    messageEventTest.test('emit healthCheck event for healthcheck request method', test => {
      let healthCheckSpy = sandbox.spy()

      let wsEmitter = new EventEmitter()
      wsEmitter.connect = sandbox.stub()
      wsEmitter.isConnected = sandbox.stub().returns(false)
      WebSocket.create.returns(wsEmitter)

      let kmsConnection = KmsConnection.create()
      kmsConnection.on('healthCheck', healthCheckSpy)

      let connectPromise = kmsConnection.connect()
      wsEmitter.emit('open')

      connectPromise
        .then(() => {
          let healthCheck = { jsonrpc: '2.0', id: 'e1c609bd-e147-460b-ae61-98264bc935ad', method: 'healthcheck', params: { level: 'ping' } }
          wsEmitter.emit('message', JSON.stringify(healthCheck))

          test.ok(healthCheckSpy.calledWith(sandbox.match({
            id: healthCheck.id,
            level: healthCheck.params.level
          })))
          test.end()
        })
    })

    messageEventTest.test('emit inquiry event for inquiry request method', test => {
      let inquirySpy = sandbox.spy()

      let wsEmitter = new EventEmitter()
      wsEmitter.connect = sandbox.stub()
      wsEmitter.isConnected = sandbox.stub().returns(false)
      WebSocket.create.returns(wsEmitter)

      let kmsConnection = KmsConnection.create()
      kmsConnection.on('inquiry', inquirySpy)

      let connectPromise = kmsConnection.connect()
      wsEmitter.emit('open')

      const now = Moment()
      const start = Moment(now).subtract(15, 'days')

      const endTime = now.toISOString()
      const startTime = start.toISOString()

      connectPromise
        .then(() => {
          let inquiry = { jsonrpc: '2.0', id: 'e1c609bd-e147-460b-ae61-98264bc935ad', method: 'inquiry', params: { inquiry: '4e4f2a70-e0d6-42dc-9efb-6d23060ccd6f', startTime, endTime } }
          wsEmitter.emit('message', JSON.stringify(inquiry))

          test.ok(inquirySpy.calledWith(sandbox.match({
            id: inquiry.id,
            inquiryId: inquiry.params.inquiry,
            startTime,
            endTime
          })))
          test.end()
        })
    })

    messageEventTest.test('log warning for unknown request method', test => {
      let wsEmitter = new EventEmitter()
      wsEmitter.connect = sandbox.stub()
      wsEmitter.isConnected = sandbox.stub().returns(false)
      WebSocket.create.returns(wsEmitter)

      let kmsConnection = KmsConnection.create()

      let connectPromise = kmsConnection.connect()
      wsEmitter.emit('open')

      connectPromise
        .then(() => {
          let unknown = JSON.stringify({ jsonrpc: '2.0', id: 'e1c609bd-e147-460b-ae61-98264bc935ad', method: 'unknown', params: { test: 1 } })
          wsEmitter.emit('message', unknown)

          test.ok(Logger.warn.calledWith(`Unhandled request from KMS received: ${unknown}`))
          test.end()
        })
    })

    messageEventTest.test('complete pending request with matching response id', test => {
      let id = 'test'

      let requestCompleteStub = sandbox.stub()
      let requestExistsStub = sandbox.stub()
      Requests.create.returns({ complete: requestCompleteStub, exists: requestExistsStub })

      let wsEmitter = new EventEmitter()
      wsEmitter.connect = sandbox.stub()
      wsEmitter.isConnected = sandbox.stub().returns(false)
      WebSocket.create.returns(wsEmitter)

      let kmsConnection = KmsConnection.create()

      let connectPromise = kmsConnection.connect()
      wsEmitter.emit('open')

      requestExistsStub.withArgs(id).returns(true)

      connectPromise
        .then(() => {
          let response = { jsonrpc: '2.0', id, result: { test: 1 } }
          wsEmitter.emit('message', JSON.stringify(response))

          test.ok(requestCompleteStub.calledOnce)
          test.ok(requestCompleteStub.calledWith(id, sandbox.match({
            result: response.result
          })))
          test.end()
        })
    })

    messageEventTest.test('log warning for unknown response id', test => {
      let id = 'test'

      let requestCompleteStub = sandbox.stub()
      let requestExistsStub = sandbox.stub()
      Requests.create.returns({ complete: requestCompleteStub, exists: requestExistsStub })

      let wsEmitter = new EventEmitter()
      wsEmitter.connect = sandbox.stub()
      wsEmitter.isConnected = sandbox.stub().returns(false)
      WebSocket.create.returns(wsEmitter)

      let kmsConnection = KmsConnection.create()

      let connectPromise = kmsConnection.connect()
      wsEmitter.emit('open')

      requestExistsStub.withArgs(id).returns(false)

      connectPromise
        .then(() => {
          let response = { jsonrpc: '2.0', id: 'test2', result: { test: 1 } }
          wsEmitter.emit('message', JSON.stringify(response))

          test.notOk(requestCompleteStub.called)
          test.end()
        })
    })

    messageEventTest.end()
  })

  kmsConnTest.end()
})
