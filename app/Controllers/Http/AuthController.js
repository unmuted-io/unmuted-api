'use strict'

const User = use('App/Models/User')

class AuthController {
  async register({request, auth, response}) {
    const username = request.input("username")
    const email = request.input("email")
    const password = request.input("password")
    let user = new User()
    const randInt = Math.floor(Math.random() * 100000)
    user.username = username + randInt
    user.email = email + randInt
    user.password = password
    user = await user.save()
    let thisUser = await User.findBy('email', email)
    // console.log('thisUser: ', thisUser)
    const accessToken = await auth.generate(thisUser)
    // console.log('accessToken is; ', accessToken)
    return response.json({"user": user, "access_token": accessToken})
  }

  async login({request, auth, response}) {
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
}

module.exports = AuthController
