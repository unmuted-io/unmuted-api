'use strict'

class TransactionController {
	constructor ({ socket, request }) {
		this.socket = socket
		this.request = request
	}
}

module.exports = TransactionController
