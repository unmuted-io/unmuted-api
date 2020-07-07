const app = require('http').createServer()
const io = require('socket.io')(app)

const WebSocket = require('ws')
const port = 9825

// for socket.io
app.listen(port, () => console.log('Server listening on port:', port))
io.on('connection', function (socket) {
	console.log('user connected1 to socket: ', socket)
	socket.emit('welcome', 'welcome man2')
	io.emit('welcome', 'welcome man3')
})

// raw websockets, currently for video processing progress
const wss = new WebSocket.Server({
	port: 9824
})

wss.on('connection', function connection(ws) {
	console.log('wss:9824 wss connected')
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

module.exports = io