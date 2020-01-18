'use strict'

class ChatController {
  constructor ({ socket, request }) {
    this.socket = socket
    this.request = request
    console.log('inside chatController')
  }

  onMessage (message) {
    console.log('chat message is: ', message)
    const timestamp = Date.now()
    const output = {
      username: message.username,
      content: message.content,
      timestamp
    }
    console.log('output: ', output)
    this.socket.broadcastToAll('message', output)
  }

  onClose () {
    console.log('chat channel closing')
  }

  onError (e) {
    console.log('chat channel error: ', e)
  }
}

module.exports = ChatController
