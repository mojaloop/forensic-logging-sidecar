'use strict'

const Shared = require('@mojaloop/central-services-shared')
const BaseError = Shared.BaseError
const Category = Shared.ErrorCategory

const KmsResponseError = class extends BaseError {
  constructor (errorId, message) {
    super(Category.INTERNAL, message)
    this.errorId = errorId
  }
}

module.exports = KmsResponseError
