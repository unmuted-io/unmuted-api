'use strict'

const User = use('App/Models/User')

class AuthController {
  register = async ({ request, auth, response }) => {
  	const username = request.input('username')
  	const email = request.input('email')
  	const password = request.input('password')
  	const edge_username = request.input('edge_username')
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
  	return response.json({'user': user, 'access_token': accessToken})
  }

  login = async ({ request, auth, response }) => {
  	const email = request.input('email')
  	const password = request.input('password')
  	try {
  		if (await auth.withRefreshToken().attempt(email, password)) {
  			let user = await User.findBy('email', email)
  			let accessToken = await auth.generate(user)
  			const output = { 'user': user, 'access_token': accessToken}
  			return response.json(output)
  		}
  	}
  	catch (e) {
  		return response.json({message: 'You first need to register!'})
  	}
  }

  checkUsername = async ({ request, auth, response }) => {
  	const { username } = request.params
  	const result = await User.findBy('username', username)
  	const isAvailable = result ? false : true
  	return response.json({ isAvailable })
  }

  getUserByParam = async ({ request, auth, response }) => {
  	const { field, value } = request.params
  	const user = await User.findBy(field, value)
  	if (!user) return response.status(204).send()
  	const accessToken = await auth.generate(user)
  	return response.json({ user, access_token: accessToken })
  }

  updateUsername = async ({ request, auth, response }) => {
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
}

module.exports = AuthController
