'use strict'

class ChatController {
  constructor ({ socket, request }) {
    this.socket = socket
    this.request = request
    console.log('inside chatController')
  }

  onMessage (message) {
    this.socket.broadcastToAll('message', message)
  }

  onClose () {
    console.log('chat channel closing')
  }

  onError (e) {
    console.log('chat channel error: ', e)
  }
}

module.exports = ChatController
