const WebSocket = require('ws')

const wss = new WebSocket.Server({
	port: 9824
})

wss.on('connection', function connection(ws) {
	console.log('wss connected')
	ws.on('message', function incoming(message) {
		console.log('received: %s', message)
		wss.clients.forEach(client => {
			if (client.readyState === WebSocket.OPEN) {
				if (message.includes('complete: ')) {
					client.send(100)
				} else {
					client.send(message)
				}
			}
		})
	})

	ws.send('websocket started')
})