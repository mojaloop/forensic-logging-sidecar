'use strict'

const src = '../../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Moment = require('moment')
const Db = require(`${src}/lib/db`)
const Model = require(`${src}/domain/batch/model`)

Test('Batches model', modelTest => {
  let sandbox

  modelTest.beforeEach((t) => {
    sandbox = Sinon.sandbox.create()

    Db.batches = {
      insert: sandbox.stub(),
      query: sandbox.stub()
    }

    t.end()
  })

  modelTest.afterEach((t) => {
    sandbox.restore()
    t.end()
  })

  modelTest.test('create should', createTest => {
    createTest.test('save payload and return new batch', test => {
      let payload = { batchId: 'event-id', sidecarId: 'sidecar-id', data: 'test data', signature: 'test' }
      let insertedBatch = { batchId: payload.batchId }

      Db.batches.insert.returns(P.resolve(insertedBatch))

      Model.create(payload)
        .then(s => {
          test.ok(Db.batches.insert.withArgs(payload).calledOnce)
          test.equal(s, insertedBatch)
          test.end()
        })
    })

    createTest.end()
  })

  modelTest.test('findForService should', findForServiceTest => {
    findForServiceTest.test('find sidecar batches for a service and timespan', test => {
      let now = Moment.utc()
      let start = Moment.utc(now).subtract(5, 'minutes')

      let service = 'test-service'
      let startTime = start.toISOString()
      let endTime = start.toISOString()

      let batches = [{ batchId: '1' }, { batchId: '2' }]

      let builderStub = sandbox.stub()
      let whereStub = sandbox.stub()
      let andWhere1Stub = sandbox.stub()
      let andWhere2Stub = sandbox.stub()
      let selectStub = sandbox.stub()
      let orderByStub = sandbox.stub()

      builderStub.join = sandbox.stub()

      Db.batches.query.callsArgWith(0, builderStub)
      Db.batches.query.returns(P.resolve(batches))

      builderStub.join.returns({
        where: whereStub.returns({
          andWhere: andWhere1Stub.returns({
            andWhere: andWhere2Stub.returns({
              select: selectStub.returns({
                orderBy: orderByStub
              })
            })
          })
        })
      })

      Model.findForService(service, startTime, endTime)
        .then(found => {
          test.equal(found, batches)
          test.ok(builderStub.join.calledWith('sidecars', 'sidecars.sidecarId', '=', 'batches.sidecarId'))
          test.ok(whereStub.calledWith('sidecars.serviceName', service))
          test.ok(andWhere1Stub.calledWith('batches.created', '>=', startTime))
          test.ok(andWhere2Stub.calledWith('batches.created', '<=', endTime))
          test.ok(selectStub.calledWith('batches.*'))
          test.ok(orderByStub.calledWith('batches.created', 'asc'))
          test.end()
        })
    })

    findForServiceTest.end()
  })

  modelTest.end()
})
