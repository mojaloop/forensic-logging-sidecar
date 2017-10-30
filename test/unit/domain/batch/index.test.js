'use strict'

const src = '../../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Uuid = require('uuid4')
const Moment = require('moment')
const Model = require(`${src}/domain/batch/model`)
const AsymmetricCrypto = require(`${src}/crypto/asymmetric`)
const EventService = require(`${src}/domain/event`)
const Proxyquire = require('proxyquire')

Test('Batch service', serviceTest => {
  let sandbox
  let uuidStub
  let Service

  serviceTest.beforeEach((t) => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Model, 'findForService')
    sandbox.stub(Model, 'create')
    sandbox.stub(EventService, 'getUnbatchedEventsByIds')
    sandbox.stub(EventService, 'assignEventsToBatch')
    sandbox.stub(EventService, 'getSignableEvent')
    sandbox.stub(Moment, 'utc')
    sandbox.stub(AsymmetricCrypto, 'sign')

    uuidStub = sandbox.stub()

    Service = Proxyquire(`${src}/domain/batch`, { 'uuid4': uuidStub })

    t.end()
  })

  serviceTest.afterEach((t) => {
    sandbox.restore()
    t.end()
  })

  serviceTest.test('create should', createTest => {
    createTest.test('create batch and update events', test => {
      let sidecarId = Uuid()
      let batchId = Uuid()
      let eventIds = [1, 2]
      let signingKey = 'DFDE22A3276FC520A24FBE5534EDADFE080D78375C4530E038EFCF6CA699228A'
      let now = Moment()

      uuidStub.returns(batchId)

      let savedBatch = {}
      Model.create.returns(P.resolve(savedBatch))

      let signature = 'signature'
      AsymmetricCrypto.sign.returns(signature)

      Moment.utc.returns(now)

      let unbatchedEvents = [{ eventId: eventIds[0], sidecarId, sequence: 1, message: 'test1', signature: 'sig1', created: now }, { eventId: eventIds[1], sidecarId, sequence: 2, message: 'test2', signature: 'sig2', created: now }].map(e => {
        e.signable = { keyId: e.sidecarId, sequence: e.sequence, message: e.message, timestamp: e.created.toISOString() }
        return e
      })

      EventService.getSignableEvent.withArgs(unbatchedEvents[0]).returns(unbatchedEvents[0].signable)
      EventService.getSignableEvent.withArgs(unbatchedEvents[1]).returns(unbatchedEvents[1].signable)
      EventService.getUnbatchedEventsByIds.returns(P.resolve(unbatchedEvents))
      EventService.assignEventsToBatch.returns(P.resolve())

      let batchData = JSON.stringify(unbatchedEvents.map(e => {
        return {
          row: e.signable,
          signature: e.signature
        }
      }))

      Service.create(sidecarId, eventIds, signingKey)
        .then(s => {
          test.ok(EventService.getUnbatchedEventsByIds.calledWith(eventIds))
          test.ok(EventService.assignEventsToBatch.calledWith(unbatchedEvents, savedBatch))
          test.ok(AsymmetricCrypto.sign.calledWith(batchData, signingKey))
          test.ok(Model.create.calledWith(sandbox.match({
            batchId,
            sidecarId,
            data: batchData,
            signature,
            created: now
          })))
          test.equal(s, savedBatch)
          test.end()
        })
    })

    createTest.end()
  })

  serviceTest.test('findForService should', findForServiceTest => {
    findForServiceTest.test('find batches for timespan', test => {
      let now = Moment()
      let start = Moment(now).subtract(5, 'minutes')

      let batches = [{ batchId: '1' }, { batchId: '2' }]
      Model.findForService.returns(P.resolve(batches))

      const service = 'test-service'
      const startTime = start.toISOString()
      const endTime = now.toISOString()

      Service.findForService(service, startTime, endTime)
        .then(found => {
          test.equal(found, batches)
          test.ok(Model.findForService.calledWith(service, startTime, endTime))
          test.end()
        })
    })

    findForServiceTest.test('convert dates to strings before calling model', test => {
      let now = Moment()
      let start = Moment(now).subtract(5, 'minutes')

      let batches = [{ batchId: '1' }, { batchId: '2' }]
      Model.findForService.returns(P.resolve(batches))

      const service = 'test-service'
      const startTime = start.toISOString()
      const endTime = now.toISOString()

      Service.findForService(service, start, now)
        .then(found => {
          test.equal(found, batches)
          test.ok(Model.findForService.calledWith(service, startTime, endTime))
          test.end()
        })
    })

    findForServiceTest.end()
  })

  serviceTest.end()
})
