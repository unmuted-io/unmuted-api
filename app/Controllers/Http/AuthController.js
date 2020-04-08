'use strict'

const User = use('App/Models/User')

class AuthController {
  register = async ({ request, auth, response }) => {
    const username = request.input("username")
    const email = request.input("email")
    const password = request.input("password")
    let user = new User()
    user.username = username
    user.email = email
    user.password = password
    user = await user.save()
    let thisUser = await User.findBy('email', email)
    const accessToken = await auth.generate(thisUser)
    return response.json({"user": user, "access_token": accessToken})
  }

  login = async ({ request, auth, response }) => {
    const email = request.input("email")
    const password = request.input("password");
    try {
      if (await auth.withRefreshToken().attempt(email, password)) {
        let user = await User.findBy('email', email)
        let accessToken = await auth.generate(user)
        return response.json({"user":user, "access_token": accessToken})
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

  updateUsername = async ({ request, auth, response }) => {
    const body = request.post()
    const { email, username } = body
    const user = await User.findBy('email', email)
    user.username = username
    await user.save()
    return response.json({ username: user.username })
  }
}

module.exports = AuthController
