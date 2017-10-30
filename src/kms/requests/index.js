'use strict'

const Uuid = require('uuid4')
const Request = require('./request')
const Errors = require('../../errors')

class Requests {
  constructor (settings) {
    this._timeout = settings.timeout

    this._existing = {}
  }

  start (func) {
    const id = this._generateId()

    let request = this._existing[id] = Request.create()
    request.build(() => func(id), this._timeout, () => delete this._existing[id])

    return this._getPromise(id)
  }

  exists (id) {
    return Boolean(this._existing[id])
  }

  complete (id, value) {
    const request = this._get(id)
    request.resolve(value)
  }

  _getPromise (id) {
    return this._existing[id] && this._existing[id].promise
  }

  _get (id) {
    const existingRequest = this._existing[id]
    if (!existingRequest) {
      throw new Errors.KmsRequestNotFoundError(id)
    }
    return existingRequest
  }

  _generateId () {
    return Uuid()
  }
}

exports.create = (settings) => {
  return new Requests(settings)
}
