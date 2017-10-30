'use strict'

const Test = require('tape')
const Uuid = require('uuid4')
const Moment = require('moment')
const Model = require('../../../../src/domain/batch/model')
const SidecarModel = require('../../../../src/domain/sidecar/model')

Test('batches model', modelTest => {
  modelTest.test('create should', createTest => {
    createTest.test('create a new batch', test => {
      const created = Moment.utc().subtract(1, 'year')

      const sidecarId = Uuid()
      const sidecar = { sidecarId, serviceName: `service-${Uuid()}`, version: '0.0.1', created }

      const batch = { batchId: Uuid(), sidecarId, data: 'test data', signature: 'test-signature', created }

      SidecarModel.create(sidecar)
        .then(() => Model.create(batch))
        .then(saved => {
          test.equal(saved.batchId, batch.batchId)
          test.equal(saved.sidecarId, batch.sidecarId)
          test.equal(saved.data, batch.data)
          test.equal(saved.signature, batch.signature)
          test.equal(saved.created.toISOString(), created.toISOString())
          test.end()
        })
    })

    createTest.end()
  })

  modelTest.test('findForService should', findForServiceTest => {
    findForServiceTest.test('find batches for service and in timespan and order by created asc', test => {
      const now = Moment.utc()
      const lastHour = Moment.utc(now).subtract(1, 'hour')

      const sidecarId = Uuid()
      const sidecar = { sidecarId, serviceName: `service-${Uuid()}`, version: '0.0.1', created: now }

      const batch = { batchId: Uuid(), sidecarId, data: 'test data', signature: 'test-signature', created: Moment.utc(now).subtract(5, 'minutes') }
      const batch2 = { batchId: Uuid(), sidecarId, data: 'another data', signature: 'diff-signature', created: Moment.utc(now).subtract(45, 'minutes') }
      const batch3 = { batchId: Uuid(), sidecarId, data: 'other data', signature: 'diff-signature', created: Moment.utc(now).subtract(5, 'hours') }

      SidecarModel.create(sidecar)
        .then(() => Model.create(batch))
        .then(() => Model.create(batch2))
        .then(() => Model.create(batch3))
        .then(() => Model.findForService(sidecar.serviceName, lastHour.toISOString(), now.toISOString()))
        .then(found => {
          test.equal(found.length, 2)
          test.equal(found[0].batchId, batch2.batchId)
          test.equal(found[1].batchId, batch.batchId)
          test.end()
        })
    })

    findForServiceTest.end()
  })

  modelTest.end()
})
