'use strict'

const src = '../../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Uuid = require('uuid4')
const Moment = require('moment')
const Model = require(`${src}/domain/event/model`)
const SymmetricCrypto = require(`${src}/crypto/symmetric`)
const Service = require(`${src}/domain/event`)

Test('Events service', serviceTest => {
  let sandbox

  serviceTest.beforeEach((t) => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Model, 'create')
    sandbox.stub(Model, 'getEventCount')
    sandbox.stub(Model, 'getUnbatchedEvents')
    sandbox.stub(Model, 'updateEvents')
    sandbox.stub(Moment, 'utc')
    sandbox.stub(SymmetricCrypto, 'sign')
    t.end()
  })

  serviceTest.afterEach((t) => {
    sandbox.restore()
    t.end()
  })

  serviceTest.test('create should', createTest => {
    createTest.test('create signature and persist to model', test => {
      const sidecarId = Uuid()
      const sequence = 1
      const message = 'test message'
      const signingKey = 'DFDE22A3276FC520A24FBE5534EDADFE080D78375C4530E038EFCF6CA699228A'
      const now = Moment()

      const savedEvent = {}
      Model.create.returns(P.resolve(savedEvent))

      const signature = 'signature'
      SymmetricCrypto.sign.returns(signature)

      Moment.utc.returns(now)

      const compactJSON = `{"keyId":"${sidecarId}","sequence":${sequence},"message":"${message}","timestamp":"${now.toISOString()}"}`

      Service.create(sidecarId, sequence, message, signingKey)
        .then(s => {
          test.ok(SymmetricCrypto.sign.calledWith(compactJSON, signingKey))
          test.ok(Model.create.calledWith(sandbox.match({
            sidecarId,
            sequence,
            message,
            signature,
            created: now
          })))
          test.equal(s, savedEvent)
          test.end()
        })
    })

    createTest.end()
  })

  serviceTest.test('getUnbatchedEventsByIds should', getUnbatchedEventsByIdsTest => {
    getUnbatchedEventsByIdsTest.test('get unbatched events from model', test => {
      const eventIds = [1, 2]
      const events = [{ eventId: eventIds[0] }, { eventId: eventIds[1] }]

      Model.getUnbatchedEvents.returns(P.resolve(events))

      Service.getUnbatchedEventsByIds(eventIds)
        .then(found => {
          test.equal(found, events)
          test.ok(Model.getUnbatchedEvents.calledWith(eventIds))
          test.end()
        })
    })

    getUnbatchedEventsByIdsTest.end()
  })

  serviceTest.test('getEventCountInTimespan should', getEventCountTest => {
    getEventCountTest.test('get event count from model', test => {
      const now = Moment()
      const start = Moment(now).subtract(5, 'minutes')
      const sidecarId = 'sidecar-id'
      const count = 6

      Model.getEventCount.returns(P.resolve(count))

      const startTime = start.toISOString()
      const endTime = now.toISOString()

      Service.getEventCountInTimespan(sidecarId, startTime, endTime)
        .then(c => {
          test.equal(c, count)
          test.ok(Model.getEventCount.calledWith(sidecarId, sandbox.match({ startTime, endTime })))
          test.end()
        })
    })

    getEventCountTest.test('convert dates to strings before calling model', test => {
      const now = Moment()
      const start = Moment(now).subtract(5, 'minutes')
      const sidecarId = 'sidecar-id'
      const count = 6

      Model.getEventCount.returns(P.resolve(count))

      const startTime = start.toISOString()
      const endTime = now.toISOString()

      Service.getEventCountInTimespan(sidecarId, start, now)
        .then(c => {
          test.equal(c, count)
          test.ok(Model.getEventCount.calledWith(sidecarId, sandbox.match({ startTime, endTime })))
          test.end()
        })
    })

    getEventCountTest.end()
  })

  serviceTest.test('assignEventsToBatch should', assignEventsTest => {
    assignEventsTest.test('update events with batch id', test => {
      const batchId = 1
      const batch = { batchId }
      const events = [{ eventId: 1 }, { eventId: 2 }]
      const updatedEvents = [{ eventId: 1, batchId }, { eventId: 2, batchId }]

      Model.updateEvents.returns(P.resolve(updatedEvents))

      Service.assignEventsToBatch(events, batch)
        .then(e => {
          test.equal(e, updatedEvents)
          test.ok(Model.updateEvents.calledWith([1, 2], { batchId }))
          test.end()
        })
    })

    assignEventsTest.end()
  })

  serviceTest.end()
})
