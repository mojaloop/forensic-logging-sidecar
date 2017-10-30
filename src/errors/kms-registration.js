'use strict'

const Shared = require('@mojaloop/central-services-shared')
const BaseError = Shared.BaseError
const Category = Shared.ErrorCategory

const KmsRegistrationError = class extends BaseError {
  constructor (message) {
    super(Category.INTERNAL, message)
  }
}

module.exports = KmsRegistrationError
