const { test, trait } = use('Test/Suite')('User')
const User = use('App/Models/User')

trait('Test/ApiClient')

const suffix = Math.floor(Math.random() * 10000000)
const email = 'test@test' + suffix + '.com'
const password = 'mypassword234'
const username = 'kylantest' + suffix

test('Register user', async ({ client, assert }) => {
	const registrationResponse = await client.post('/auth/register')
		.field('username', username)
		.field('email', email)
		.field('password', password)
		.end()
	// console.log('registrationResponse.body is: ', registrationResponse.body)
	registrationResponse.assertStatus(200)
	const registrationBody = registrationResponse.body
	assert.isTrue(registrationBody.user)
	assert.equal(registrationBody.access_token.type, 'bearer', 'Registration token should be type \'bearer\'')
	assert.isString(registrationBody.access_token.token, 'Token should exist')
	assert.equal(registrationBody.access_token.token.length, 119, 'Registration bearer token length')
	assert.isNull(registrationBody.access_token.refreshToken, 'Registration refresh token should be null')

})

test('Login user', async ({ client, assert }) => {
	const loginResponse = await client.post('/auth/login')
		.field('email', email)
		.field('password', password)
		.end()
	loginResponse.assertStatus(200)
	const loginBody = loginResponse.body
	// console.log('loginBody: ', loginBody)
	assert.isNumber(loginBody.user.id)
	assert.equal(loginBody.user.username, username)
	assert.isString(loginBody.user.created_at)
	assert.isString(loginBody.user.updated_at)
	assert.equal(loginBody.access_token.type, 'bearer', 'Login token should be type \'bearer\'')
	assert.equal(loginBody.access_token.token.length, 119, 'Login bearer token length')
	assert.isNull(loginBody.access_token.refreshToken, 'Login refresh token should be null')
})