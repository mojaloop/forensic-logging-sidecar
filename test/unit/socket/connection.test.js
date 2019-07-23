'use strict'

const src = '../../../src'
const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const EventEmitter = require('events')
const Fixtures = require('../fixtures')
const TcpConnection = require(`${src}/socket/connection`)

Test('TcpConnection', tcpConnTest => {
  let sandbox

  tcpConnTest.beforeEach(t => {
    sandbox = Sinon.sandbox.create()
    t.end()
  })

  tcpConnTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  tcpConnTest.test('close should', closeTest => {
    closeTest.test('call end method on socket', test => {
      const socket = new EventEmitter()
      socket.end = sandbox.stub()

      const conn = TcpConnection.create(socket)
      conn.close()

      test.ok(socket.end.calledOnce)
      test.end()
    })

    closeTest.end()
  })

  tcpConnTest.test('pause should', pauseTest => {
    pauseTest.test('call pause method on socket', test => {
      const socket = new EventEmitter()
      socket.pause = sandbox.stub()

      const conn = TcpConnection.create(socket)
      conn.pause()

      test.ok(socket.pause.calledOnce)
      test.end()
    })

    pauseTest.end()
  })

  tcpConnTest.test('resume should', resumeTest => {
    resumeTest.test('call resume method on socket', test => {
      const socket = new EventEmitter()
      socket.resume = sandbox.stub()

      const conn = TcpConnection.create(socket)
      conn.resume()

      test.ok(socket.resume.calledOnce)
      test.end()
    })

    resumeTest.end()
  })

  tcpConnTest.test('receiving socket end should', receiveCloseTest => {
    receiveCloseTest.test('emit end event', test => {
      const socket = new EventEmitter()
      const endSpy = sandbox.spy()

      const conn = TcpConnection.create(socket)
      conn.on('end', endSpy)

      socket.emit('end')

      test.ok(endSpy.called)
      test.end()
    })

    receiveCloseTest.end()
  })

  tcpConnTest.test('receving socket error should', receiveErrorTest => {
    receiveErrorTest.test('emit error event with existing error object', test => {
      const socket = new EventEmitter()
      const errorSpy = sandbox.spy()

      const socketErr = new Error('this is bad')

      const conn = TcpConnection.create(socket)
      conn.on('error', errorSpy)

      socket.emit('error', socketErr)

      test.ok(errorSpy.called)
      test.ok(errorSpy.calledWith(socketErr))
      test.end()
    })

    receiveErrorTest.end()
  })

  tcpConnTest.test('receiving socket data should', receiveDataTest => {
    receiveDataTest.test('handle request and emit message event', test => {
      const socket = new EventEmitter()
      const messageSpy = sandbox.spy()

      const message = JSON.stringify({ id: 1, name: 'test' })
      const sendBuffer = Fixtures.writeMessageToBufferWithLength(message)
      const receiveBuffer = Fixtures.writeMessageToBuffer(message)

      const conn = TcpConnection.create(socket)
      conn.on('message', messageSpy)

      socket.emit('data', sendBuffer)

      test.ok(messageSpy.called)
      test.ok(messageSpy.calledWith(receiveBuffer))
      test.end()
    })

    receiveDataTest.test('handle multiple requests sent sequentially', test => {
      const socket = new EventEmitter()
      const messageSpy = sandbox.spy()
      const receiveBuffers = []

      const message = JSON.stringify({ id: 1, name: 'test' })
      const sendBuffer = Fixtures.writeMessageToBufferWithLength(message)
      receiveBuffers.push(Fixtures.writeMessageToBuffer(message))

      const message2 = JSON.stringify({ row: 5, key: 'key', value: 'val' })
      const sendBuffer2 = Fixtures.writeMessageToBufferWithLength(message2)
      receiveBuffers.push(Fixtures.writeMessageToBuffer(message2))

      const message3 = JSON.stringify({ id: '1ab042bd-e098-4d96-ae8b-e07aefd04ca4', serviceName: 'service' })
      const sendBuffer3 = Fixtures.writeMessageToBufferWithLength(message3)
      receiveBuffers.push(Fixtures.writeMessageToBuffer(message3))

      const conn = TcpConnection.create(socket)
      conn.on('message', messageSpy)

      socket.emit('data', sendBuffer)
      socket.emit('data', sendBuffer2)
      socket.emit('data', sendBuffer3)

      test.equal(messageSpy.callCount, receiveBuffers.length)
      receiveBuffers.forEach((b) => {
        test.ok(messageSpy.calledWith(b))
      })
      test.end()
    })

    receiveDataTest.test('handle message split over multiple data events', test => {
      const socket = new EventEmitter()
      const messageSpy = sandbox.spy()

      const message = JSON.stringify({ id: '1ab042bd-e098-4d96-ae8b-e07aefd04ca4', serviceName: 'service' })
      const sendBuffer = Fixtures.writeMessageToBufferWithLength(message)
      const receiveBuffer = Fixtures.writeMessageToBuffer(message)

      const partialBuffer1 = sendBuffer.slice(0, 5)
      const partialBuffer2 = sendBuffer.slice(5)

      const conn = TcpConnection.create(socket)
      conn.on('message', messageSpy)

      socket.emit('data', partialBuffer1)
      socket.emit('data', partialBuffer2)

      test.ok(messageSpy.called)
      test.ok(messageSpy.calledWith(receiveBuffer))
      test.end()
    })

    receiveDataTest.test('handle multiple messages split over multiple data events', test => {
      const socket = new EventEmitter()
      const messageSpy = sandbox.spy()
      const receiveBuffers = []

      const message = JSON.stringify({ id: '1ab042bd-e098-4d96-ae8b-e07aefd04ca4', serviceName: 'service' })
      const sendBuffer = Fixtures.writeMessageToBufferWithLength(message)
      receiveBuffers.push(Fixtures.writeMessageToBuffer(message))

      const message2 = JSON.stringify({ row: 5, key: 'key', value: 'val' })
      const sendBuffer2 = Fixtures.writeMessageToBufferWithLength(message2)
      receiveBuffers.push(Fixtures.writeMessageToBuffer(message2))

      // Append the beginning of the second buffer to the first buffer.
      const partialBuffer1 = Fixtures.appendToBuffer(sendBuffer, sendBuffer2.slice(0, 5))
      const partialBuffer2 = sendBuffer2.slice(5)

      const conn = TcpConnection.create(socket)
      conn.on('message', messageSpy)

      socket.emit('data', partialBuffer1)
      socket.emit('data', partialBuffer2)

      test.equal(messageSpy.callCount, receiveBuffers.length)
      receiveBuffers.forEach((b) => {
        test.ok(messageSpy.calledWith(b))
      })
      test.end()
    })

    receiveDataTest.test('handle multiple messages in one data event', test => {
      const socket = new EventEmitter()
      const messageSpy = sandbox.spy()
      const receiveBuffers = []

      const message = JSON.stringify({ id: '1ab042bd-e098-4d96-ae8b-e07aefd04ca4', serviceName: 'service' })
      const sendBuffer = Fixtures.writeMessageToBufferWithLength(message)
      receiveBuffers.push(Fixtures.writeMessageToBuffer(message))

      const message2 = JSON.stringify({ row: 5, key: 'key', value: 'val' })
      const sendBuffer2 = Fixtures.writeMessageToBufferWithLength(message2)
      receiveBuffers.push(Fixtures.writeMessageToBuffer(message2))

      const combinedBuffer = Fixtures.appendToBuffer(sendBuffer, sendBuffer2)

      const conn = TcpConnection.create(socket)
      conn.on('message', messageSpy)

      socket.emit('data', combinedBuffer)

      test.equal(messageSpy.callCount, receiveBuffers.length)
      receiveBuffers.forEach((b) => {
        test.ok(messageSpy.calledWith(b))
      })
      test.end()
    })

    receiveDataTest.test('not emit message event if sent data with no prefix header', test => {
      const socket = new EventEmitter()
      const messageSpy = sandbox.spy()

      const sendBuffer = Buffer.from('junk data')

      const conn = TcpConnection.create(socket)
      conn.on('message', messageSpy)

      socket.emit('data', sendBuffer)

      test.notOk(messageSpy.called)
      test.end()
    })

    receiveDataTest.end()
  })

  tcpConnTest.end()
})
