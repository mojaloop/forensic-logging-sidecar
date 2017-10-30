'use strict'

const Test = require('tape')
const Uuid = require('uuid4')
const Moment = require('moment')
const Model = require('../../../../src/domain/sidecar/model')

Test('sidecar model', modelTest => {
  modelTest.test('create should', createTest => {
    createTest.test('create a new sidecar', test => {
      const created = Moment.utc().subtract(1, 'year')
      const sidecar = { sidecarId: Uuid(), serviceName: `service-${Uuid()}`, version: '0.0.1', created }

      Model.create(sidecar)
        .then(saved => {
          test.equal(saved.sidecarId, sidecar.sidecarId)
          test.equal(saved.serviceName, sidecar.serviceName)
          test.equal(saved.version, sidecar.version)
          test.equal(saved.created.toISOString(), created.toISOString())
          test.end()
        })
    })

    createTest.end()
  })

  modelTest.end()
})
