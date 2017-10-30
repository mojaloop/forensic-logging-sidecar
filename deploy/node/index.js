'use strict'

const Aws = require('./aws')
const Ecr = require('./ecr')
const Jfrog = require('./jfrog')
const Variables = require('./variables')

const deploy = () => {
  const version = Variables.VERSION
  Aws.configureAws()
    .then(() => Ecr.pushImageToEcr(Variables.IMAGE, version))
    .then(() => Jfrog.login())
    .then(() => Jfrog.pushImageToJFrog(Variables.IMAGE, version))
    .catch(e => {
      console.error(e)
      process.exit(1)
    })
}

module.exports = deploy()
