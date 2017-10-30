'use strict'

class Keys {
  constructor () {
    this._rowKey = null
    this._batchKey = null
  }

  store (keys) {
    this._rowKey = keys.rowKey
    this._batchKey = keys.batchKey
  }

  getRowKey () {
    return this._rowKey
  }

  getBatchKey () {
    return this._batchKey
  }
}

exports.create = () => {
  return new Keys()
}
