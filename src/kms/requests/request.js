'use strict'

const P = require('bluebird')

class Request {
  constructor () {
    this.promise = undefined

    this._resolve = undefined
    this._reject = undefined
  }

  build (func, timeout, finallyFunc) {
    this._createPromise(func)
    this._setupTimeout(timeout)
    this._handleFinally(finallyFunc)
  }

  resolve (val) {
    this._resolve(val)
  }

  reject (err) {
    this._reject(err)
  }

  _createPromise (func) {
    this.promise = new P((resolve, reject) => {
      this._resolve = resolve
      this._reject = reject
      if (func) {
        func()
      }
    })
  }

  _setupTimeout (timeout) {
    if (timeout) {
      this.promise = this.promise.timeout(timeout, `Request timed out after ${timeout} ms`)
    }
  }

  _handleFinally (finallyFunc) {
    if (finallyFunc) {
      this.promise = this.promise.finally(finallyFunc)
    }
  }
}

exports.create = () => {
  return new Request()
}
