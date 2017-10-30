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

    uuidStub = sandbox.stub()

    Sidecar = Proxyquire(`${src}/sidecar`, { 'uuid4': uuidStub })

    t.end()
  })

  sidecarTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  sidecarTest.test('create should', createTest => {
    createTest.test('create new sidecar and setup', test => {
      let now = new Date()
      Moment.utc.returns(now)

      let sidecarId = 'sidecar-id'
      uuidStub.returns(sidecarId)

      let kmsOnStub = sandbox.stub()
      KmsConnection.create.returns({ 'on': kmsOnStub })

      let socketOnStub = sandbox.stub()
      SocketListener.create.returns({ 'on': socketOnStub })

      let batchTrackerOnStub = sandbox.stub()
      BatchTracker.create.returns({ 'on': batchTrackerOnStub })

      let settings = { serviceName: 'test-service', kms: { url: 'ws://test.com', pingInterval: 30000, requestTimeout: 15000, connectTimeout: 9000, reconnectInterval: 2000 }, port: 1234, batchSize: 50, batchTimeInterval: 45000, version: '1.2.3' }
      let sidecar = Sidecar.create(settings)

      test.equal(sidecar.id, sidecarId)
      test.equal(sidecar.port, settings.port)
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
      let now = new Date()
      Moment.utc.returns(now)

      let sidecarId = 'sidecar-id'
      uuidStub.returns(sidecarId)

      let connectStub = sandbox.stub()
      connectStub.returns(P.resolve())

      let keys = { batchKey: 'batch', rowKey: 'row' }
      let registerStub = sandbox.stub()
      registerStub.returns(P.resolve(keys))

      let keyStore = { store: sandbox.stub() }
      Keys.create.returns(keyStore)

      KmsConnection.create.returns({ connect: connectStub, register: registerStub, 'on': sandbox.stub() })

      BatchTracker.create.returns({ 'on': sandbox.stub() })

      let listenStub = sandbox.stub()
      SocketListener.create.returns({ 'on': sandbox.stub(), listen: listenStub })

      SidecarService.create.returns(P.resolve())

      let settings = { serviceName: 'test-service', kmsUrl: 'ws://test.com', kmsPingInterval: 30000, port: 1234, batchSize: 50, version: '1.2.3' }
      let sidecar = Sidecar.create(settings)

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
      let connectStub = sandbox.stub()
      connectStub.returns(P.resolve())

      let keys = { batchKey: 'batch', rowKey: 'row' }
      let registerStub = sandbox.stub()
      registerStub.returns(P.resolve(keys))

      let keyStore = { store: sandbox.stub() }
      Keys.create.returns(keyStore)

      let kmsCloseStub = sandbox.stub()

      KmsConnection.create.returns({ connect: connectStub, register: registerStub, 'on': sandbox.stub(), close: kmsCloseStub })

      BatchTracker.create.returns({ 'on': sandbox.stub() })

      let listenStub = sandbox.stub()
      let socketCloseStub = sandbox.stub()
      SocketListener.create.returns({ 'on': sandbox.stub(), listen: listenStub, close: socketCloseStub })

      SidecarService.create.returns(P.resolve())

      let closeSpy = sandbox.spy()
      let settings = { serviceName: 'test-service', kmsUrl: 'ws://test.com', kmsPingInterval: 30000, port: 1234, batchSize: 50, version: '1.2.3' }
      let sidecar = Sidecar.create(settings)
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
      let id = 'id1'
      let reconnectId = 'id2'

      uuidStub.onFirstCall().returns(id)
      uuidStub.onSecondCall().returns(reconnectId)

      let now = new Date()
      let reconnectNow = Moment(now).add(1, 'day')

      Moment.utc.returns(reconnectNow)

      let connectStub = sandbox.stub()
      let connectPromise = P.resolve()
      connectStub.returns(connectPromise)

      let reconnectKeys = { batchKey: 'reconnect-batch', rowKey: 'reconnect-row' }

      let storePromise = P.resolve()
      let keyStore = { store: sandbox.stub().returns(storePromise) }
      Keys.create.returns(keyStore)

      let registerStub = sandbox.stub()
      let registerPromise = P.resolve(reconnectKeys)
      registerStub.returns(registerPromise)

      let kmsConnection = new EventEmitter()
      kmsConnection.connect = connectStub
      kmsConnection.register = registerStub
      KmsConnection.create.returns(kmsConnection)

      BatchTracker.create.returns({ 'on': sandbox.stub() })

      let resumePromise = P.resolve()
      let pausePromise = P.resolve()
      let socketListener = { 'on': sandbox.stub(), listen: sandbox.stub(), pause: sandbox.stub().returns(pausePromise), resume: sandbox.stub().returns(resumePromise) }
      SocketListener.create.returns(socketListener)

      let reconnectCreatePromise = P.resolve()
      SidecarService.create.returns(reconnectCreatePromise)

      let settings = { serviceName: 'test-service', kmsUrl: 'ws://test.com', kmsPingInterval: 30000, port: 1234, batchSize: 50, version: '1.2.3' }
      let sidecar = Sidecar.create(settings)

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
                              test.ok(Logger.info.calledWith(`Successfully reconnected to KMS as id ${reconnectId}`))
                              test.end()
                            })
                        })
                    })
                })
            })
        })
    })

    kmsCloseTest.test('stop sidecar if error during reconnect attempt', test => {
      let id = 'id1'
      let reconnectId = 'id2'

      uuidStub.onFirstCall().returns(id)
      uuidStub.onSecondCall().returns(reconnectId)

      let now = new Date()
      let reconnectNow = Moment(now).add(1, 'day')

      Moment.utc.returns(reconnectNow)

      let connectStub = sandbox.stub()
      let connectPromise = P.resolve()
      connectStub.returns(connectPromise)

      let reconnectKeys = { batchKey: 'reconnect-batch', rowKey: 'reconnect-row' }

      let storePromise = P.resolve()
      let keyStore = { store: sandbox.stub().returns(storePromise) }
      Keys.create.returns(keyStore)

      let registerStub = sandbox.stub()
      let registerPromise = P.resolve(reconnectKeys)
      registerStub.returns(registerPromise)

      let kmsConnection = new EventEmitter()
      kmsConnection.connect = connectStub
      kmsConnection.register = registerStub
      kmsConnection.close = sandbox.stub()
      KmsConnection.create.returns(kmsConnection)

      BatchTracker.create.returns({ 'on': sandbox.stub() })

      let resumeError = new Error('Bad error')
      let resumePromise = P.reject(resumeError)
      let socketCloseStub = sandbox.stub()
      let pausePromise = P.resolve()
      let socketListener = { 'on': sandbox.stub(), listen: sandbox.stub(), pause: sandbox.stub().returns(pausePromise), close: socketCloseStub, resume: sandbox.stub().returns(resumePromise) }
      SocketListener.create.returns(socketListener)

      let reconnectCreatePromise = P.resolve()
      SidecarService.create.returns(reconnectCreatePromise)

      let closeSpy = sandbox.spy()
      let settings = { serviceName: 'test-service', kmsUrl: 'ws://test.com', kmsPingInterval: 30000, port: 1234, batchSize: 50, version: '1.2.3' }
      let sidecar = Sidecar.create(settings)
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
                              test.ok(Logger.error.calledWith('Error reconnecting to KMS, stopping sidecar', err))
                              test.ok(kmsConnection.close.calledOnce)
                              test.ok(socketCloseStub.calledOnce)
                              test.ok(closeSpy.calledOnce)
                              test.end()
                            })
                        })
                    })
                })
            })
        })
    })

    kmsCloseTest.test('stop sidecar if canReconnect flag flase', test => {
      let connectStub = sandbox.stub()
      connectStub.returns(P.resolve())

      let keys = { batchKey: 'batch', rowKey: 'row' }
      let registerStub = sandbox.stub()
      registerStub.returns(P.resolve(keys))

      let keyStore = { store: sandbox.stub() }
      Keys.create.returns(keyStore)

      let kmsConnection = new EventEmitter()
      kmsConnection.connect = connectStub
      kmsConnection.register = registerStub
      kmsConnection.close = sandbox.stub()
      KmsConnection.create.returns(kmsConnection)

      BatchTracker.create.returns({ 'on': sandbox.stub() })

      let socketCloseStub = sandbox.stub()
      SocketListener.create.returns({ 'on': sandbox.stub(), listen: sandbox.stub(), close: socketCloseStub })

      SidecarService.create.returns(P.resolve())

      let closeSpy = sandbox.spy()
      let settings = { serviceName: 'test-service', kmsUrl: 'ws://test.com', kmsPingInterval: 30000, port: 1234, batchSize: 50, version: '1.2.3' }
      let sidecar = Sidecar.create(settings)
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
      let connectStub = sandbox.stub()
      connectStub.returns(P.resolve())

      let keys = { batchKey: 'batch', rowKey: 'row' }
      let registerStub = sandbox.stub()
      registerStub.returns(P.resolve(keys))

      let keyStore = { store: sandbox.stub() }
      Keys.create.returns(keyStore)

      let kmsConnection = new EventEmitter()
      kmsConnection.connect = connectStub
      kmsConnection.register = registerStub
      kmsConnection.respondToInquiry = sandbox.stub().returns(P.resolve())
      KmsConnection.create.returns(kmsConnection)

      SocketListener.create.returns({ 'on': sandbox.stub(), listen: sandbox.stub() })

      BatchTracker.create.returns({ 'on': sandbox.stub() })

      let found = [{ batchId: 'batch1', data: 'data' }, { batchId: 'batch2', data: 'data2' }]
      let findPromise = P.resolve(found)
      BatchService.findForService.returns(findPromise)

      let sendId = 'send-id'
      let sendId2 = 'send-id2'
      uuidStub.onSecondCall().returns(sendId)
      uuidStub.onThirdCall().returns(sendId2)

      SidecarService.create.returns(P.resolve())

      let settings = { serviceName: 'test-service', kmsUrl: 'ws://test.com', kmsPingInterval: 30000, port: 1234, batchSize: 50, version: '1.2.3' }
      let sidecar = Sidecar.create(settings)

      let now = Moment()
      let start = Moment(now).subtract(1, 'month')

      let request = { id: 'id', inquiryId: 'inquiry-id', startTime: start.toISOString(), endTime: now.toISOString() }
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
      let connectStub = sandbox.stub()
      connectStub.returns(P.resolve())

      let keys = { batchKey: 'batch', rowKey: 'row' }
      let registerStub = sandbox.stub()
      registerStub.returns(P.resolve(keys))

      let keyStore = { store: sandbox.stub() }
      Keys.create.returns(keyStore)

      let kmsConnection = new EventEmitter()
      kmsConnection.connect = connectStub
      kmsConnection.register = registerStub
      kmsConnection.respondToHealthCheck = sandbox.stub().returns(P.resolve())
      KmsConnection.create.returns(kmsConnection)

      SocketListener.create.returns({ 'on': sandbox.stub(), listen: sandbox.stub() })

      BatchTracker.create.returns({ 'on': sandbox.stub() })

      let healthCheck = {}
      let healthCheckPromise = P.resolve(healthCheck)
      HealthCheck.ping.returns(healthCheckPromise)

      SidecarService.create.returns(P.resolve())

      let settings = { serviceName: 'test-service', kmsUrl: 'ws://test.com', kmsPingInterval: 30000, port: 1234, batchSize: 50, version: '1.2.3' }
      let sidecar = Sidecar.create(settings)

      let request = { id: 1, 'level': 'ping' }
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
      let connectStub = sandbox.stub()
      connectStub.returns(P.resolve())

      let keys = { batchKey: 'batch', rowKey: 'row' }
      let registerStub = sandbox.stub()
      registerStub.returns(P.resolve(keys))

      let keyStore = { store: sandbox.stub() }
      Keys.create.returns(keyStore)

      let kmsConnection = new EventEmitter()
      kmsConnection.connect = connectStub
      kmsConnection.register = registerStub
      KmsConnection.create.returns(kmsConnection)

      SocketListener.create.returns({ 'on': sandbox.stub(), listen: sandbox.stub() })

      BatchTracker.create.returns({ 'on': sandbox.stub() })

      SidecarService.create.returns(P.resolve())

      let settings = { serviceName: 'test-service', kmsUrl: 'ws://test.com', kmsPingInterval: 30000, port: 1234, batchSize: 50, version: '1.2.3' }
      let sidecar = Sidecar.create(settings)

      let request = { id: 1, 'level': 'details' }
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
      let startSequence = 5

      let connectStub = sandbox.stub()
      connectStub.returns(P.resolve())

      let keys = { batchKey: 'batch', rowKey: 'row' }
      let registerStub = sandbox.stub()
      registerStub.returns(P.resolve(keys))

      let keyStore = { store: sandbox.stub(), getRowKey: sandbox.stub().returns(keys.rowKey) }
      Keys.create.returns(keyStore)

      KmsConnection.create.returns({ connect: connectStub, register: registerStub, 'on': sandbox.stub() })

      let eventCreatedStub = sandbox.stub()
      BatchTracker.create.returns({ eventCreated: eventCreatedStub, 'on': sandbox.stub() })

      let socketListener = new EventEmitter()
      socketListener.listen = sandbox.stub()
      SocketListener.create.returns(socketListener)

      let event = { eventId: 'event-id', sequence: startSequence + 1 }
      let eventPromise = P.resolve(event)
      EventService.create.returns(eventPromise)

      SidecarService.create.returns(P.resolve())

      let settings = { serviceName: 'test-service', kmsUrl: 'ws://test.com', kmsPingInterval: 30000, port: 1234, batchSize: 50, version: '1.2.3' }
      let sidecar = Sidecar.create(settings)
      sidecar._sequence = startSequence

      let msg = JSON.stringify({ id: 1, name: 'test' })
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
      let batchId = 'batch-id'
      let batchSignature = 'sig'

      let connectStub = sandbox.stub()
      connectStub.returns(P.resolve())

      let keys = { batchKey: 'batch', rowKey: 'row' }
      let registerStub = sandbox.stub()
      registerStub.returns(P.resolve(keys))

      let keyStore = { store: sandbox.stub(), getBatchKey: sandbox.stub().returns(keys.batchKey) }
      Keys.create.returns(keyStore)

      let kmsBatchResponse = { result: { id: batchId } }
      let kmsBatchPromise = P.resolve(kmsBatchResponse)
      let sendBatchStub = sandbox.stub().returns(kmsBatchPromise)

      KmsConnection.create.returns({ connect: connectStub, register: registerStub, sendBatch: sendBatchStub, 'on': sandbox.stub() })

      SocketListener.create.returns({ 'on': sandbox.stub(), listen: sandbox.stub() })

      let batchTracker = new EventEmitter()
      batchTracker.event = sandbox.stub()
      BatchTracker.create.returns(batchTracker)

      let batchEventIds = [1, 2]

      let batch = { batchId, signature: batchSignature }
      let batchPromise = P.resolve(batch)
      BatchService.create.returns(batchPromise)

      SidecarService.create.returns(P.resolve())

      let settings = { serviceName: 'test-service', kmsUrl: 'ws://test.com', kmsPingInterval: 30000, port: 1234, batchSize: 50, version: '1.2.3' }
      let sidecar = Sidecar.create(settings)

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
      let batchId = 'batch-id'
      let batchSignature = 'sig'

      let connectStub = sandbox.stub()
      connectStub.returns(P.resolve())

      let keys = { batchKey: 'batch', rowKey: 'row' }
      let registerStub = sandbox.stub()
      registerStub.returns(P.resolve(keys))

      let keyStore = { store: sandbox.stub(), getBatchKey: sandbox.stub().returns(keys.batchKey) }
      Keys.create.returns(keyStore)

      let err = new Error('error sending batch')
      let kmsBatchPromise = P.reject(err)
      let sendBatchStub = sandbox.stub().returns(kmsBatchPromise)

      KmsConnection.create.returns({ connect: connectStub, register: registerStub, sendBatch: sendBatchStub, 'on': sandbox.stub() })

      SocketListener.create.returns({ 'on': sandbox.stub(), listen: sandbox.stub() })

      let batchTracker = new EventEmitter()
      batchTracker.event = sandbox.stub()
      BatchTracker.create.returns(batchTracker)

      let batchEventIds = [1, 2]

      let batch = { batchId, signature: batchSignature }
      let batchPromise = P.resolve(batch)
      BatchService.create.returns(batchPromise)

      SidecarService.create.returns(P.resolve())

      let settings = { serviceName: 'test-service', kmsUrl: 'ws://test.com', kmsPingInterval: 30000, port: 1234, batchSize: 50, version: '1.2.3' }
      let sidecar = Sidecar.create(settings)

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
