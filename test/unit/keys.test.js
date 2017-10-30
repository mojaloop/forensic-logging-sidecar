'use strict'

const src = '../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Keys = require(`${src}/keys`)

Test('Keys', keysTest => {
  let sandbox

  keysTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    t.end()
  })

  keysTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  keysTest.test('create should', createTest => {
    createTest.test('create new key store and set properties', test => {
      let keyStore = Keys.create()

      test.equal(keyStore._rowKey, null)
      test.equal(keyStore._batchKey, null)
      test.end()
    })

    createTest.end()
  })

  keysTest.test('store should', storeTest => {
    storeTest.test('store batch key and row key', test => {
      let keyStore = Keys.create()

      let keys = { rowKey: 'row-key', batchKey: 'batch-key' }

      keyStore.store(keys)
      test.equal(keyStore._rowKey, keys.rowKey)
      test.equal(keyStore._batchKey, keys.batchKey)
      test.end()
    })

    storeTest.end()
  })

  keysTest.test('getRowKey should', rowKeyTest => {
    rowKeyTest.test('return stored row key', test => {
      let keyStore = Keys.create()

      let keys = { rowKey: 'row-key', batchKey: 'batch-key' }

      keyStore.store(keys)
      test.equal(keyStore.getRowKey(), keys.rowKey)
      test.end()
    })

    rowKeyTest.test('return null if no row key stored', test => {
      let keyStore = Keys.create()
      test.equal(keyStore.getRowKey(), null)
      test.end()
    })

    rowKeyTest.end()
  })

  keysTest.test('getBatchKey should', batchKeyTest => {
    batchKeyTest.test('return stored batch key', test => {
      let keyStore = Keys.create()

      let keys = { rowKey: 'row-key', batchKey: 'batch-key' }

      keyStore.store(keys)
      test.equal(keyStore.getBatchKey(), keys.batchKey)
      test.end()
    })

    batchKeyTest.test('return null if no batch key stored', test => {
      let keyStore = Keys.create()
      test.equal(keyStore.getBatchKey(), null)
      test.end()
    })

    batchKeyTest.end()
  })

  keysTest.end()
})
