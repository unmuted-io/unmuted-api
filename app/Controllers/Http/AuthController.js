'use strict'
const crypto = require('crypto')
const base32 = require('hi-base32')
const User = use('App/Models/User')
const Jimp = require('jimp')

class AuthController {
	async register ({ request, auth, response }) {
		const body = request.post()
		const { username, email, password, edge_username } = body
		let user = new User()
		user.username = username
		user.email = email
		user.password = password
		user.edge_username = edge_username
		user = await user.save()
		let key
		let value
		if (email) {
			key = 'email'
			value = email
		} else if (edge_username) {
			key = 'edge_username'
			value = edge_username
		}
		let thisUser = await User.findBy(key, value)
		const accessToken = await auth.generate(thisUser)
		return response.json({ user: user, access_token: accessToken })
	}

	async login ({ request, auth, response }) {
		const email = request.input('email')
		const password = request.input('password')
		try {
			if (await auth.withRefreshToken().attempt(email, password)) {
				let user = await User.findBy('email', email)
				let accessToken = await auth.generate(user)
				const output = { user: user, access_token: accessToken }
				return response.json(output)
			}
		} catch (e) {
			return response.json({ message: 'You first need to register!' })
		}
	}

	async checkUsername ({ request, auth, response }) {
		const { username } = request.params
		const result = await User.findBy('username', username)
		const isAvailable = result ? false : true
		return response.json({ isAvailable })
	}

	async getUserByParam ({ request, auth, response }) {
		const { field, value } = request.params
		const user = await User.findBy(field, value)
		if (!user) return response.status(204).send()
		const accessToken = await auth.generate(user)
		return response.json({ user, access_token: accessToken })
	}

	async updateUsername ({ request, auth, response }) {
		const body = request.post()
		const { email, username, edge_username } = body
		let key
		let value
		if (email) {
			key = 'email'
			value = email
		} else if (edge_username) {
			key = 'edge_username'
			value = edge_username
		}
		const user = await User.findBy(key, value)
		user.username = username
		await user.save()
		return response.json({ username: user.username })
	}

	async updateProfileImage ({ request, params, response }) {
		const { type } = params
		const requirements = {
			profile: {
				maxHeight: 1600,
				maxWidth: 1600
			},
			cover: {
				maxHeight: 1600,
				maxWidth: 4800
			}
		}
		const file = request.file('file')
		let rand = await crypto.randomBytes(8)
		// make a random string
		rand = base32.encode(rand).replace(/===/i, '')

		const time = new Date().getTime()
		// set the source filename
		const source = `${time}-${rand}.jpg`

		const img = await Jimp.read(file.tmpPath)
		const { maxHeight, maxWidth } = requirements[type]
		img.scaleToFit(maxWidth, maxHeight)
			// .background('#FFFFFF') // only needed for PNG
			.quality(85)
			.write(`public/images/profile/${type}/${source}`)

		return response.status(200).send({ type, source })
	}

	async saveProfileImage ({ request, response }) {
		const { type, file: base64Image } = request.body
		const requirements = {
			profile: {
				maxHeight: 400,
				maxWidth: 400
			},
			cover: {
				maxHeight: 400,
				maxWidth: 1600
			}
		}
		let rand = await crypto.randomBytes(8)
		// make a random string
		rand = base32.encode(rand).replace(/===/i, '')

		const time = new Date().getTime()
		// set the source filename
		const source = `${time}-${rand}.jpg`
		const strippedBase64 = base64Image
			.replace('data:image/jpg;base64', '')
			.replace('data:image/jpeg;base64', '')
		const buff = Buffer.from(strippedBase64, 'base64')
		const img = await Jimp.read(buff)
		const { maxHeight, maxWidth } = requirements[type]
		img.scaleToFit(maxWidth, maxHeight)
			// .background('#FFFFFF') // only needed for PNG
			.quality(85)
			.write(`public/images/profile/${type}/${source}`)

		return response.status(200).send({ type, source })
	}
}

module.exports = AuthController
