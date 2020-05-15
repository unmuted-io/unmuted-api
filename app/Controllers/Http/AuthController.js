/* global use */

'use strict'
const crypto = require('crypto')
const base32 = require('hi-base32')
const User = use('App/Models/User')
const Jimp = require('jimp')
var jwtDecode = require('jwt-decode')
const Database = use('Database')

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
		try {
			const authHeader = request.header('Authorization')
			let user
			if (authHeader) {
				const decodedToken = jwtDecode(authHeader.replace('Bearer ', ''))
				user = await User.find(decodedToken.uid)
				const tokens = await auth.withRefreshToken().generate(user)
				const output = { user, access_token: tokens}
				return response.json(output)
			} else {
				const email = request.input('email')
				const password = request.input('password')
				const tokens = await auth.withRefreshToken().attempt(email, password)
				if (tokens) {
					let user = await User.findBy('email', email)
					const output = { user, access_token: tokens }
					return response.json(output)
				}
			}
		} catch (error) {
			console.log('Login error: ', error)
			return response.status(400).send({ message: 'Unable to log in. Please check credentials and try again.' })
		}
	}

	async checkUsername ({ request, response }) {
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

	async saveProfile ({ request, auth, response }) {
		const body = request.post()
		const user = await auth.getUser()
		const stringifiedProfile = JSON.stringify(body)
		user.profile = stringifiedProfile
		await user.save()
		return response.send({ profile: stringifiedProfile })
	}

	async getChannel ({ params, response }) {
		const { channel, id } = params
		const channelResults = await User.findBy({
			username: channel
		})
		if (!channelResults) return response.status(500).send()
		console.log('channelResults: ', channelResults)
		const subscriptionResults = await Database
			.table('users')
			.innerJoin(
				'user_channel_subscriptions',
				'user_channel_subscriptions.channel_id',
				'=',
				'users.id'
			)
			.where('user_channel_subscriptions.user_id', '=',  parseInt(id) || null)
			.andWhere('user_channel_subscriptions.channel_id', '=', parseInt(channelResults.id))
		console.log('subscriptionResults: ', subscriptionResults)
		// if adding more fields, may return string instead of JSON?
		const { profile } = channelResults
		const profileObj = profile ? JSON.parse(profile) : {}
		const { profileImageUrl = '', coverImageUrl = '' } = profileObj
		const output = {
			profileImageUrl,
			coverImageUrl,
			isSubscribed: subscriptionResults[0] ? true : false
		}
		return response.send(output)
	}

	async updateUsername ({ request, response }) {
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

	async saveProfileImage ({ request, response, auth }) {
		let user
		try {
			user = await auth.getUser()
		} catch (error) {
			response.send('Missing or invalid jwt token')
		}
		const { type } = request.body
		const file = request.file('file')
		const requirements = {
			profile: {
				maxHeight: 400,
				maxWidth: 400
			},
			cover: {
				maxHeight: 400,
				maxWidth: 1200
			}
		}
		let rand = await crypto.randomBytes(8)
		// make a random string
		rand = base32.encode(rand).replace(/===/i, '')

		const time = new Date().getTime()
		// set the source filename
		const source = `${time}-${rand}.jpg`

		const img = await Jimp.read(file.tmpPath)
		const { maxHeight, maxWidth } = requirements[type]
		const path = `/images/profile/${type}/${source}`
		img.scaleToFit(maxWidth, maxHeight)
			// .background('#FFFFFF') // only needed for PNG
			.quality(85)
			.write(`public/${path}`)
		const profile = JSON.parse(user.profile) || {}
		profile[`${type}ImageUrl`] = path
		user.profile = JSON.stringify(profile)
		await user.save()
		return response.status(200).send({ profile: user.profile })
	}
}

module.exports = AuthController
