/* global use */

'use strict'
const Database = use('Database')
const io = require('../../../ws')

class VideoChatController {
	constructor() {
		console.log('in video chat controller')
		this.rooms = []
		this.startChatRooms()
	}

	async startChatRooms() {
		const affectedRows = await Database.table('videos')
		// loop through videos
		affectedRows.forEach((row) => {
			const { rand } = row
			// create room based on hash
			const room = io
				.of(`/${rand}`)
				.on('connection', (socket) => {
					console.log('connected socket: ', socket)
					this.rooms.push(rand)
					socket.emit('message', `Hello and welcome to the video room: ${rand}`)
					socket.on('userMessage', (data) => {
						console.log('a userMessage has come in, data', data)
						room.emit('message', {
							content: `${data.content}`,
							username: data.username,
							amount: 0,
							timestamp: Date.now(),
						})
					})
					// when someone joins room
					socket.on('joinRoom', (room) => {
						// send message user?
						if (this.rooms.includes(room)) {
							socket.join(room)
							socket.emit(
								'success',
								'You have successfully joined room: ' + rand
							)
						} else {
							socket.emit('err', 'Error, no room: ' + rand)
						}
					})
				})
		})
	}
}

module.exports = VideoChatController
