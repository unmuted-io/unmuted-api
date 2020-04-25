const WebSocket = require('ws')

const wss = new WebSocket.Server({
	port: 9824
})

wss.on('connection', function connection(ws) {
	console.log('wss connected')
	ws.on('message', function incoming(message) {
		console.log('received: ', message)
		wss.clients.forEach(client => {
			if (client.readyState === WebSocket.OPEN) {
				client.send(message)
			}
		})
	})

	ws.send('websocket started')
})