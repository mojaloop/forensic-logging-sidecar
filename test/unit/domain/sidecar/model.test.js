'use strict'

const src = '../../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const P = require('bluebird')
const Db = require(`${src}/lib/db`)
const Model = require(`${src}/domain/sidecar/model`)

Test('Sidecars model', modelTest => {
  let sandbox

  modelTest.beforeEach((t) => {
    sandbox = Sinon.sandbox.create()

    Db.sidecars = {
      insert: sandbox.stub()
    }

    t.end()
  })

  modelTest.afterEach((t) => {
    sandbox.restore()
    t.end()
  })

  modelTest.test('create should', createTest => {
    createTest.test('save payload and return new sidecar', test => {
      let payload = { sidecarId: 'sidecar-id', serviceName: 'test service', version: '0.0.1' }
      let insertedSidecar = { sidecarId: 'id' }

      Db.sidecars.insert.returns(P.resolve(insertedSidecar))

      Model.create(payload)
        .then(s => {
          test.ok(Db.sidecars.insert.withArgs(payload).calledOnce)
          test.equal(s, insertedSidecar)
          test.end()
        })
    })

    createTest.end()
  })

  modelTest.end()
})
