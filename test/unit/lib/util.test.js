'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Util = require('../../../src/lib/util')

Test('Util', utilTest => {
  let sandbox

  utilTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    t.end()
  })

  utilTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  utilTest.test('isString should', isStringTest => {
    isStringTest.test('test if value is string', test => {
      test.ok(Util.isString('this is a string'))
      test.notOk(Util.isString(5))
      test.notOk(Util.isString({}))
      test.notOk(Util.isString([]))
      test.end()
    })

    isStringTest.end()
  })

  utilTest.end()
})
