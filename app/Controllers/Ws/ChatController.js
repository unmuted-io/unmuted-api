'use strict'
const { createDfuseClient, waitFor, dynamicMessageDispatcher } = require("@dfuse/client")
global.fetch = require('node-fetch')
global.WebSocket = require('ws')

class ChatController {
  constructor ({ socket, request }) {
    this.socket = socket
    this.request = request
    console.log('inside chatController')
    this.scanTransactions()
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

  async scanTransactions () {
    const client = createDfuseClient({
      apiKey: 'web_3a9a2fb4e88f48030f08f1ac3e45195d',
      network: 'mainnet'
    })

    const streamTransfer = `subscription($cursor: String!) {
      searchTransactionsForward(query: "receiver:eosio.token action:transfer data.from:haytemrtg4ge", cursor: $cursor) {
        undo cursor
        trace {
          matchingActions { json }
        }
      }
    }`

    const stream = await client.graphql(streamTransfer, (message) => {
      if (message.type === "error") {
        console.log("An error occurred", message.errors, message.terminal)
      }

      if (message.type === "data") {
        const data = message.data.searchTransactionsForward
        const actions = data.trace.matchingActions

        actions.forEach(({ json }) => {
          const { from, to, quantity, memo } = json
          console.log(`Transfer [${from} -> ${to}, ${quantity}] (${memo})`)
        })

        stream.mark({ cursor: data.cursor })
      }

      if (message.type === "complete") {
        console.log("Stream completed")
      }
    })
  }
}

module.exports = ChatController
