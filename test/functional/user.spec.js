const { test, trait } = use('Test/Suite')('User')
const User = use('App/Models/User')

trait('Test/ApiClient')

test('Register a user', async ({ client, assert }) => {
  const suffix = Math.floor(Math.random() * 10000000)

  const response = await client.post('/auth/register')
    .field('username', 'kylantest' + suffix)
    .field('email', 'test@test' + suffix + '.com')
    .field('password', 'mypassword234')
    .end()
  // console.log('response.body is: ', response.body)
  response.assertStatus(200)
  assert.isTrue(response.body.user)
  assert.equal(response.body.access_token.type, 'bearer', "Token should be type 'bearer'")
  assert.isString(response.body.access_token.token, 'Token should exist')
  assert.equal(response.body.access_token.token.length, 119, 'Bearer token length')
  assert.isNull(response.body.access_token.refreshToken, 'Refresh token should be null')
})
