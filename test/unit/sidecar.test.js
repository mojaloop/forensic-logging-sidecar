'use strict'

const src = '../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Moment = require('moment')
const EventEmitter = require('events')
const Logger = require('@mojaloop/central-services-shared').Logger
const Keys = require(`${src}/keys`)
const KmsConnection = require(`${src}/kms`)
const HealthCheck = require(`${src}/health-check`)
const SocketListener = require(`${src}/socket`)
const EventService = require(`${src}/domain/event`)
const BatchService = require(`${src}/domain/batch`)
const BatchTracker = require(`${src}/domain/batch/tracker`)
const SidecarService = require(`${src}/domain/sidecar`)
const Proxyquire = require('proxyquire')
const Health = require(`${src}/health`)

Test('Sidecar', sidecarTest => {
  let sandbox
  let uuidStub
  let Sidecar

  sidecarTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Logger)
    sandbox.stub(Moment, 'utc')
    sandbox.stub(Keys, 'create')
    sandbox.stub(HealthCheck, 'ping')
    sandbox.stub(BatchTracker, 'create')
    sandbox.stub(KmsConnection, 'create')
    sandbox.stub(EventService, 'create')
    sandbox.stub(BatchService, 'create')
    sandbox.stub(BatchService, 'findForService')
    sandbox.stub(SidecarService, 'create')
    sandbox.stub(SocketListener, 'create')
    sandbox.stub(Health)
    uuidStub = sandbox.stub()

    Sidecar = Proxyquire(`${src}/sidecar`, { uuid4: uuidStub })

    t.end()
  })

  sidecarTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  sidecarTest.test('create should', createTest => {
    createTest.test('create new sidecar and setup', test => {
      const now = new Date()
      Moment.utc.returns(now)

      const sidecarId = 'sidecar-id'
      uuidStub.returns(sidecarId)

      const kmsOnStub = sandbox.stub()
      KmsConnection.create.returns({ on: kmsOnStub })

      const socketOnStub = sandbox.stub()
      SocketListener.create.returns({ on: socketOnStub })

      const batchTrackerOnStub = sandbox.stub()
      BatchTracker.create.returns({ on: batchTrackerOnStub })

      const settings = { serviceName: 'test-service', kms: { url: 'ws://test.com', pingInterval: 30000, requestTimeout: 15000, connectTimeout: 9000, reconnectInterval: 2000 }, port: 1234, batchSize: 50, batchTimeInterval: 45000, version: '1.2.3', healthPort: 2345 }
      const sidecar = Sidecar.create(settings)

      test.equal(sidecar.id, sidecarId)
      test.equal(sidecar.port, settings.port)
      test.equal(sidecar.healthPort, settings.healthPort)
      test.equal(sidecar.service, settings.serviceName)

      test.equal(sidecar.startTime, now)
      test.equal(sidecar.version, settings.version)

      test.equal(sidecar._sequence, 0)

      test.ok(KmsConnection.create.calledWith(settings.kms))
      test.ok(kmsOnStub.calledWith('healthCheck'))
      test.ok(SocketListener.create.calledOnce)
      test.ok(socketOnStub.calledWith('message'))
      test.ok(BatchTracker.create.calledWith(sandbox.match({
        batchSize: settings.batchSize,
        batchTimeInterval: settings.batchTimeInterval
      })))
      test.ok(batchTrackerOnStub.calledWith('batchReady'))
      test.end()
    })

    createTest.end()
  })

  sidecarTest.test('start should', startTest => {
    startTest.test('save sidecar to datastore then register with KMS then start SocketListener listening', test => {
      const now = new Date()
      Moment.utc.returns(now)

      const sidecarId = 'sidecar-id'
      uuidStub.returns(sidecarId)

      const connectStub = sandbox.stub()
      connectStub.returns(P.resolve())

      const keys = { batchKey: 'batch', rowKey: 'row' }
      const registerStub = sandbox.stub()
      registerStub.returns(P.resolve(keys))

      const keyStore = { store: sandbox.stub() }
      Keys.create.returns(keyStore)

      KmsConnection.create.returns({ connect: connectStub, register: registerStub, on: sandbox.stub() })

      BatchTracker.create.returns({ on: sandbox.stub() })

      const listenStub = sandbox.stub()
      SocketListener.create.returns({ on: sandbox.stub(), listen: listenStub })

      SidecarService.create.returns(P.resolve())

      const settings = { serviceName: 'test-service', kmsUrl: 'ws://test.com', kmsPingInterval: 30000, port: 1234, batchSize: 50, version: '1.2.3', healthPort: 2345 }
      const sidecar = Sidecar.create(settings)

      sidecar.start()
        .then(() => {
          test.ok(SidecarService.create.calledWith(sidecarId, sidecar.service, sidecar.version, now))

          test.ok(connectStub.calledOnce)
          test.ok(registerStub.calledOnce)
          test.ok(registerStub.calledWith(sidecarId, sidecar.service))
          test.ok(keyStore.store.calledWith(keys))
          test.ok(listenStub.calledWith(settings.port))
          test.end()
        })
    })

    startTest.end()
  })

  sidecarTest.test('stop should', stopTest => {
    stopTest.test('stop services and emit close event', test => {
      const connectStub = sandbox.stub()
      connectStub.returns(P.resolve())

      const keys = { batchKey: 'batch', rowKey: 'row' }
      const registerStub = sandbox.stub()
      registerStub.returns(P.resolve(keys))

      const keyStore = { store: sandbox.stub() }
      Keys.create.returns(keyStore)

      const kmsCloseStub = sandbox.stub()

      KmsConnection.create.returns({ connect: connectStub, register: registerStub, on: sandbox.stub(), close: kmsCloseStub })

      BatchTracker.create.returns({ on: sandbox.stub() })

      const listenStub = sandbox.stub()
      const socketCloseStub = sandbox.stub()
      SocketListener.create.returns({ on: sandbox.stub(), listen: listenStub, close: socketCloseStub })

      SidecarService.create.returns(P.resolve())

      const closeSpy = sandbox.spy()
      const settings = { serviceName: 'test-service', kmsUrl: 'ws://test.com', kmsPingInterval: 30000, port: 1234, batchSize: 50, version: '1.2.3', healthPort: 2345 }
      const sidecar = Sidecar.create(settings)
      sidecar.on('close', closeSpy)

      sidecar.start()
        .then(() => {
          sidecar.stop()

          test.ok(kmsCloseStub.calledOnce)
          test.ok(socketCloseStub.calledOnce)
          test.ok(closeSpy.calledOnce)
          test.end()
        })
    })

    stopTest.end()
  })

  sidecarTest.test('receving KMS connectionClose event should', kmsCloseTest => {
    kmsCloseTest.test('attempt to reconnect to KMS if canReconnet flag true', test => {
      const id = 'id1'
      const reconnectId = 'id2'

      uuidStub.onFirstCall().returns(id)
      uuidStub.onSecondCall().returns(reconnectId)

      const now = new Date()
      const reconnectNow = Moment(now).add(1, 'day')

      Moment.utc.returns(reconnectNow)

      const connectStub = sandbox.stub()
      const connectPromise = P.resolve()
      connectStub.returns(connectPromise)

      const reconnectKeys = { batchKey: 'reconnect-batch', rowKey: 'reconnect-row' }

      const storePromise = P.resolve()
      const keyStore = { store: sandbox.stub().returns(storePromise) }
      Keys.create.returns(keyStore)

      const registerStub = sandbox.stub()
      const registerPromise = P.resolve(reconnectKeys)
      registerStub.returns(registerPromise)

      const kmsConnection = new EventEmitter()
      kmsConnection.connect = connectStub
      kmsConnection.register = registerStub
      KmsConnection.create.returns(kmsConnection)

      BatchTracker.create.returns({ on: sandbox.stub() })

      const resumePromise = P.resolve()
      const pausePromise = P.resolve()
      const socketListener = { on: sandbox.stub(), listen: sandbox.stub(), pause: sandbox.stub().returns(pausePromise), resume: sandbox.stub().returns(resumePromise) }
      SocketListener.create.returns(socketListener)

      const reconnectCreatePromise = P.resolve()
      SidecarService.create.returns(reconnectCreatePromise)

      const settings = { serviceName: 'test-service', kmsUrl: 'ws://test.com', kmsPingInterval: 30000, port: 1234, batchSize: 50, version: '1.2.3', healthPort: 2345 }
      const sidecar = Sidecar.create(settings)

      test.equal(sidecar.id, id)
      test.equal(sidecar.startTime, reconnectNow)

      kmsConnection.emit('connectionClose', true)

      test.ok(socketListener.pause.calledOnce)
      test.equal(sidecar.id, reconnectId)
      test.equal(sidecar.startTime, reconnectNow)
      test.equal(sidecar._sequence, 0)

      pausePromise
        .then(() => {
          reconnectCreatePromise
            .then(() => {
              test.ok(SidecarService.create.calledWith(reconnectId, settings.serviceName, settings.version, reconnectNow))
              connectPromise
                .then(() => {
                  test.ok(connectStub.calledOnce)
                  registerPromise
                    .then(() => {
                      test.ok(registerStub.calledOnce)
                      storePromise
                        .then(() => {
                          test.ok(keyStore.store.calledWith(reconnectKeys))
                          resumePromise
                            .then(() => {
                              test.ok(socketListener.resume.calledOnce)
                              test.notOk(Logger.info.calledWith(`Successfully reconnected to KMS as id ${reconnectId}`))
                              test.end()
                            })
                        })
                    })
                })
            })
        })
    })

    kmsCloseTest.test('stop sidecar if error during reconnect attempt', test => {
      const id = 'id1'
      const reconnectId = 'id2'

      uuidStub.onFirstCall().returns(id)
      uuidStub.onSecondCall().returns(reconnectId)

      const now = new Date()
      const reconnectNow = Moment(now).add(1, 'day')

      Moment.utc.returns(reconnectNow)

      const connectStub = sandbox.stub()
      const connectPromise = P.resolve()
      connectStub.returns(connectPromise)

      const reconnectKeys = { batchKey: 'reconnect-batch', rowKey: 'reconnect-row' }

      const storePromise = P.resolve()
      const keyStore = { store: sandbox.stub().returns(storePromise) }
      Keys.create.returns(keyStore)

      const registerStub = sandbox.stub()
      const registerPromise = P.resolve(reconnectKeys)
      registerStub.returns(registerPromise)

      const kmsConnection = new EventEmitter()
      kmsConnection.connect = connectStub
      kmsConnection.register = registerStub
      kmsConnection.close = sandbox.stub()
      KmsConnection.create.returns(kmsConnection)

      BatchTracker.create.returns({ on: sandbox.stub() })

      const resumeError = new Error('Bad error')
      const resumePromise = P.reject(resumeError)
      const socketCloseStub = sandbox.stub()
      const pausePromise = P.resolve()
      const socketListener = { on: sandbox.stub(), listen: sandbox.stub(), pause: sandbox.stub().returns(pausePromise), close: socketCloseStub, resume: sandbox.stub().returns(resumePromise) }
      SocketListener.create.returns(socketListener)

      const reconnectCreatePromise = P.resolve()
      SidecarService.create.returns(reconnectCreatePromise)

      const closeSpy = sandbox.spy()
      const settings = { serviceName: 'test-service', kmsUrl: 'ws://test.com', kmsPingInterval: 30000, port: 1234, batchSize: 50, version: '1.2.3' }
      const sidecar = Sidecar.create(settings)
      sidecar.on('close', closeSpy)

      test.equal(sidecar.id, id)
      test.equal(sidecar.startTime, reconnectNow)

      kmsConnection.emit('connectionClose', true)

      test.ok(socketListener.pause.calledOnce)
      test.equal(sidecar.id, reconnectId)
      test.equal(sidecar.startTime, reconnectNow)
      test.equal(sidecar._sequence, 0)

      pausePromise
        .then(() => {
          reconnectCreatePromise
            .then(() => {
              test.ok(SidecarService.create.calledWith(reconnectId, settings.serviceName, settings.version, reconnectNow))
              connectPromise
                .then(() => {
                  test.ok(connectStub.calledOnce)
                  registerPromise
                    .then(() => {
                      test.ok(registerStub.calledOnce)
                      storePromise
                        .then(() => {
                          test.ok(keyStore.store.calledWith(reconnectKeys))
                          resumePromise
                            .then(() => {
                              test.fail('Should have thrown error')
                              test.end()
                            })
                            .catch(err => {
                              test.equal(err, resumeError)
                              test.notOk(Logger.error.calledWith('Error reconnecting to KMS, stopping sidecar', err))
                              test.notOk(kmsConnection.close.calledOnce)
                              test.notOk(socketCloseStub.calledOnce)
                              test.notOk(closeSpy.calledOnce)
                              test.end()
                            })
                        })
                    })
                })
            })
        })
    })

    kmsCloseTest.test('stop sidecar if canReconnect flag flase', test => {
      const connectStub = sandbox.stub()
      connectStub.returns(P.resolve())

      const keys = { batchKey: 'batch', rowKey: 'row' }
      const registerStub = sandbox.stub()
      registerStub.returns(P.resolve(keys))

      const keyStore = { store: sandbox.stub() }
      Keys.create.returns(keyStore)

      const kmsConnection = new EventEmitter()
      kmsConnection.connect = connectStub
      kmsConnection.register = registerStub
      kmsConnection.close = sandbox.stub()
      KmsConnection.create.returns(kmsConnection)

      BatchTracker.create.returns({ on: sandbox.stub() })

      const socketCloseStub = sandbox.stub()
      SocketListener.create.returns({ on: sandbox.stub(), listen: sandbox.stub(), close: socketCloseStub })

      SidecarService.create.returns(P.resolve())

      const closeSpy = sandbox.spy()
      const settings = { serviceName: 'test-service', kmsUrl: 'ws://test.com', kmsPingInterval: 30000, port: 1234, batchSize: 50, version: '1.2.3' }
      const sidecar = Sidecar.create(settings)
      sidecar.on('close', closeSpy)

      sidecar.start()
        .then(() => {
          kmsConnection.emit('connectionClose', false)

          test.ok(Logger.error.calledWith('KMS connection closed with no reconnection, stopping sidecar'))
          test.ok(kmsConnection.close.calledOnce)
          test.ok(socketCloseStub.calledOnce)
          test.ok(closeSpy.calledOnce)
          test.end()
        })
    })

    kmsCloseTest.end()
  })

  sidecarTest.test('receving KMS inquiry event should', inquiryTest => {
    inquiryTest.test('find batches for inquiry and send to KMS', test => {
      const connectStub = sandbox.stub()
      connectStub.returns(P.resolve())

      const keys = { batchKey: 'batch', rowKey: 'row' }
      const registerStub = sandbox.stub()
      registerStub.returns(P.resolve(keys))

      const keyStore = { store: sandbox.stub() }
      Keys.create.returns(keyStore)

      const kmsConnection = new EventEmitter()
      kmsConnection.connect = connectStub
      kmsConnection.register = registerStub
      kmsConnection.respondToInquiry = sandbox.stub().returns(P.resolve())
      KmsConnection.create.returns(kmsConnection)

      SocketListener.create.returns({ on: sandbox.stub(), listen: sandbox.stub() })

      BatchTracker.create.returns({ on: sandbox.stub() })

      const found = [{ batchId: 'batch1', data: 'data' }, { batchId: 'batch2', data: 'data2' }]
      const findPromise = P.resolve(found)
      BatchService.findForService.returns(findPromise)

      const sendId = 'send-id'
      const sendId2 = 'send-id2'
      uuidStub.onSecondCall().returns(sendId)
      uuidStub.onThirdCall().returns(sendId2)

      SidecarService.create.returns(P.resolve())

      const settings = { serviceName: 'test-service', kmsUrl: 'ws://test.com', kmsPingInterval: 30000, port: 1234, batchSize: 50, version: '1.2.3' }
      const sidecar = Sidecar.create(settings)

      const now = Moment()
      const start = Moment(now).subtract(1, 'month')

      const request = { id: 'id', inquiryId: 'inquiry-id', startTime: start.toISOString(), endTime: now.toISOString() }
      sidecar.start()
        .then(() => {
          kmsConnection.emit('inquiry', request)

          findPromise
            .then(() => {
              test.ok(Logger.info.calledWith(`Received inquiry ${request.inquiryId} from KMS`))
              test.ok(BatchService.findForService.calledWith(sidecar.service, request.startTime, request.endTime))
              test.ok(kmsConnection.respondToInquiry.calledWith(request, found))
              test.ok(Logger.info.calledWith(`Sent ${found.length} batches to KMS for inquiry ${request.inquiryId}`))
              test.end()
            })
        })
    })

    inquiryTest.end()
  })

  sidecarTest.test('receving KMS healthCheck event should', healthCheckTest => {
    healthCheckTest.test('run healthcheck and send response to KMS if ping', test => {
      const connectStub = sandbox.stub()
      connectStub.returns(P.resolve())

      const keys = { batchKey: 'batch', rowKey: 'row' }
      const registerStub = sandbox.stub()
      registerStub.returns(P.resolve(keys))

      const keyStore = { store: sandbox.stub() }
      Keys.create.returns(keyStore)

      const kmsConnection = new EventEmitter()
      kmsConnection.connect = connectStub
      kmsConnection.register = registerStub
      kmsConnection.respondToHealthCheck = sandbox.stub().returns(P.resolve())
      KmsConnection.create.returns(kmsConnection)

      SocketListener.create.returns({ on: sandbox.stub(), listen: sandbox.stub() })

      BatchTracker.create.returns({ on: sandbox.stub() })

      const healthCheck = {}
      const healthCheckPromise = P.resolve(healthCheck)
      HealthCheck.ping.returns(healthCheckPromise)

      SidecarService.create.returns(P.resolve())

      const settings = { serviceName: 'test-service', kmsUrl: 'ws://test.com', kmsPingInterval: 30000, port: 1234, batchSize: 50, version: '1.2.3' }
      const sidecar = Sidecar.create(settings)

      const request = { id: 1, level: 'ping' }
      sidecar.start()
        .then(() => {
          kmsConnection.emit('healthCheck', request)

          healthCheckPromise
            .then(() => {
              test.ok(Logger.info.calledWith(`Received ${request.level} health check request ${request.id} from KMS`))
              test.ok(HealthCheck.ping.calledWith(sidecar))
              test.ok(kmsConnection.respondToHealthCheck.calledWith(request, healthCheck))
              test.end()
            })
        })
    })

    healthCheckTest.test('do not run healthcheck if level is not ping', test => {
      const connectStub = sandbox.stub()
      connectStub.returns(P.resolve())

      const keys = { batchKey: 'batch', rowKey: 'row' }
      const registerStub = sandbox.stub()
      registerStub.returns(P.resolve(keys))

      const keyStore = { store: sandbox.stub() }
      Keys.create.returns(keyStore)

      const kmsConnection = new EventEmitter()
      kmsConnection.connect = connectStub
      kmsConnection.register = registerStub
      KmsConnection.create.returns(kmsConnection)

      SocketListener.create.returns({ on: sandbox.stub(), listen: sandbox.stub() })

      BatchTracker.create.returns({ on: sandbox.stub() })

      SidecarService.create.returns(P.resolve())

      const settings = { serviceName: 'test-service', kmsUrl: 'ws://test.com', kmsPingInterval: 30000, port: 1234, batchSize: 50, version: '1.2.3' }
      const sidecar = Sidecar.create(settings)

      const request = { id: 1, level: 'details' }
      sidecar.start()
        .then(() => {
          kmsConnection.emit('healthCheck', request)
          test.ok(Logger.info.calledWith(`Received ${request.level} health check request ${request.id} from KMS`))
          test.notOk(HealthCheck.ping.called)
          test.end()
        })
    })

    healthCheckTest.end()
  })

  sidecarTest.test('receiving SocketListener message event should', messageTest => {
    messageTest.test('increment sequence and save received message as an event', test => {
      const startSequence = 5

      const connectStub = sandbox.stub()
      connectStub.returns(P.resolve())

      const keys = { batchKey: 'batch', rowKey: 'row' }
      const registerStub = sandbox.stub()
      registerStub.returns(P.resolve(keys))

      const keyStore = { store: sandbox.stub(), getRowKey: sandbox.stub().returns(keys.rowKey) }
      Keys.create.returns(keyStore)

      KmsConnection.create.returns({ connect: connectStub, register: registerStub, on: sandbox.stub() })

      const eventCreatedStub = sandbox.stub()
      BatchTracker.create.returns({ eventCreated: eventCreatedStub, on: sandbox.stub() })

      const socketListener = new EventEmitter()
      socketListener.listen = sandbox.stub()
      SocketListener.create.returns(socketListener)

      const event = { eventId: 'event-id', sequence: startSequence + 1 }
      const eventPromise = P.resolve(event)
      EventService.create.returns(eventPromise)

      SidecarService.create.returns(P.resolve())

      const settings = { serviceName: 'test-service', kmsUrl: 'ws://test.com', kmsPingInterval: 30000, port: 1234, batchSize: 50, version: '1.2.3' }
      const sidecar = Sidecar.create(settings)
      sidecar._sequence = startSequence

      const msg = JSON.stringify({ id: 1, name: 'test' })
      sidecar.start()
        .then(() => {
          socketListener.emit('message', msg)

          eventPromise
            .then(() => {
              test.ok(keyStore.getRowKey.calledOnce)
              test.ok(EventService.create.calledWith(sidecar.id, event.sequence, msg, keys.rowKey))
              test.ok(eventCreatedStub.calledOnce)
              test.ok(eventCreatedStub.calledWith(event.eventId))
              test.ok(Logger.info.calledWith(`Created event ${event.eventId} with sequence ${event.sequence}`))
              test.end()
            })
        })
    })

    messageTest.end()
  })

  sidecarTest.test('receiving BatchTracker batchReady event should', messageTest => {
    messageTest.test('create batch from received event ids and send to KMS', test => {
      const batchId = 'batch-id'
      const batchSignature = 'sig'

      const connectStub = sandbox.stub()
      connectStub.returns(P.resolve())

      const keys = { batchKey: 'batch', rowKey: 'row' }
      const registerStub = sandbox.stub()
      registerStub.returns(P.resolve(keys))

      const keyStore = { store: sandbox.stub(), getBatchKey: sandbox.stub().returns(keys.batchKey) }
      Keys.create.returns(keyStore)

      const kmsBatchResponse = { result: { id: batchId } }
      const kmsBatchPromise = P.resolve(kmsBatchResponse)
      const sendBatchStub = sandbox.stub().returns(kmsBatchPromise)

      KmsConnection.create.returns({ connect: connectStub, register: registerStub, sendBatch: sendBatchStub, on: sandbox.stub() })

      SocketListener.create.returns({ on: sandbox.stub(), listen: sandbox.stub() })

      const batchTracker = new EventEmitter()
      batchTracker.event = sandbox.stub()
      BatchTracker.create.returns(batchTracker)

      const batchEventIds = [1, 2]

      const batch = { batchId, signature: batchSignature }
      const batchPromise = P.resolve(batch)
      BatchService.create.returns(batchPromise)

      SidecarService.create.returns(P.resolve())

      const settings = { serviceName: 'test-service', kmsUrl: 'ws://test.com', kmsPingInterval: 30000, port: 1234, batchSize: 50, version: '1.2.3' }
      const sidecar = Sidecar.create(settings)

      sidecar.start()
        .then(() => {
          batchTracker.emit('batchReady', batchEventIds)

          batchPromise
            .then(() => kmsBatchPromise)
            .then(() => {
              test.ok(keyStore.getBatchKey.calledOnce)
              test.ok(BatchService.create.calledWith(sidecar.id, batchEventIds, keys.batchKey))
              test.ok(sendBatchStub.calledWith(batch))
              test.ok(Logger.info.calledWith(`Sent batch ${kmsBatchResponse.id} successfully to KMS`))
              test.end()
            })
        })
    })

    messageTest.test('log error if thrown while sending batch to KMS', test => {
      const batchId = 'batch-id'
      const batchSignature = 'sig'

      const connectStub = sandbox.stub()
      connectStub.returns(P.resolve())

      const keys = { batchKey: 'batch', rowKey: 'row' }
      const registerStub = sandbox.stub()
      registerStub.returns(P.resolve(keys))

      const keyStore = { store: sandbox.stub(), getBatchKey: sandbox.stub().returns(keys.batchKey) }
      Keys.create.returns(keyStore)

      const err = new Error('error sending batch')
      const kmsBatchPromise = P.reject(err)
      const sendBatchStub = sandbox.stub().returns(kmsBatchPromise)

      KmsConnection.create.returns({ connect: connectStub, register: registerStub, sendBatch: sendBatchStub, on: sandbox.stub() })

      SocketListener.create.returns({ on: sandbox.stub(), listen: sandbox.stub() })

      const batchTracker = new EventEmitter()
      batchTracker.event = sandbox.stub()
      BatchTracker.create.returns(batchTracker)

      const batchEventIds = [1, 2]

      const batch = { batchId, signature: batchSignature }
      const batchPromise = P.resolve(batch)
      BatchService.create.returns(batchPromise)

      SidecarService.create.returns(P.resolve())

      const settings = { serviceName: 'test-service', kmsUrl: 'ws://test.com', kmsPingInterval: 30000, port: 1234, batchSize: 50, version: '1.2.3' }
      const sidecar = Sidecar.create(settings)

      sidecar.start()
        .then(() => {
          batchTracker.emit('batchReady', batchEventIds)

          batchPromise
            .then(() => kmsBatchPromise)
            .then(() => {
              test.fail('Should have thrown error')
              test.end()
            })
            .catch(e => {
              test.equal(e.message, err.message)
              test.ok(Logger.error.calledWith('Error while creating batch and sending to KMS', e))
              test.end()
            })
        })
    })

    messageTest.end()
  })

  sidecarTest.end()
})
