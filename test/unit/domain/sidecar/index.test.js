'use strict'

const src = '../../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Moment = require('moment')
const Model = require(`${src}/domain/sidecar/model`)
const Service = require(`${src}/domain/sidecar`)

Test('Sidecars service', serviceTest => {
  let sandbox

  serviceTest.beforeEach((t) => {
    sandbox = Sinon.sandbox.create()
    sandbox.stub(Model, 'create')
    t.end()
  })

  serviceTest.afterEach((t) => {
    sandbox.restore()
    t.end()
  })

  serviceTest.test('create should', createTest => {
    createTest.test('persist sidecar to model', test => {
      let sidecarId = 'sidecar-id'
      let serviceName = 'test'
      let version = '0.0.2'
      let created = Moment()

      let savedSidecar = {}
      Model.create.returns(P.resolve(savedSidecar))

      Service.create(sidecarId, serviceName, version, created)
        .then(s => {
          test.ok(Model.create.calledWith(sandbox.match({
            sidecarId,
            serviceName,
            version,
            created
          })))
          test.equal(s, savedSidecar)
          test.end()
        })
    })

    createTest.end()
  })

  serviceTest.end()
})
