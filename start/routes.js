/* global use */

'use strict'

/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| Http routes are entry points to your web application. You can create
| routes for different URLs and bind Controller actions to them.
|
| A complete guide on routing is available here.
| http://adonisjs.com/docs/4.1/routing
|
*/

/** @type {typeof import('@adonisjs/framework/src/Route/Manager')} */
const Route = use('Route')

Route.get('/', () => {
	return { greeting: 'Hello world in JSON' }
})

Route.put('videos/view', 'VideoController.updateViewCount')
Route.put('/videos/:id', 'VideoController.update').middleware('auth')
Route.delete('/videos/id', 'VideoController.destroy').middleware('auth')
Route.get('/videos', 'VideoController.index')
Route.get('/videos/rec/:quantity?/:username?', 'VideoController.getRecommended')
Route.get('/videos/:id', 'VideoController.show')
Route.get('/videos/processed/:id', 'VideoController.show') // may need to be changed later
Route.get(
	'/videos/recently-viewed/:username/:quantity?',
	'VideoController.getRecentlyViewed'
)

// multimedia processing
Route.post('/videos', 'MediaController.store').middleware('auth')
Route.post('/videos/message', 'MediaController.message')

// users and auth
Route.post('/auth/register', 'AuthController.register')
Route.post('/auth/login', 'AuthController.login')
Route.get('/auth/check-username/:username', 'AuthController.checkUsername')
Route.put('/auth/username', 'AuthController.updateUsername')
Route.put('/user/profile', 'AuthController.saveProfile').middleware('auth')
Route.post('/user/image/save', 'AuthController.saveProfileImage').middleware(
	'auth'
)
Route.post('/user/image/:type', 'AuthController.updateProfileImage').middleware(
	'auth'
)
Route.get('/user/:field/:value', 'AuthController.getUserByParam')
Route.get('/channel/:channel/:id?', 'AuthController.getChannel')

// video ratings
Route.post('/video-rating', 'VideoRatingController.store')
Route.get(
	'/video-rating/:uuid/user/:username',
	'VideoRatingController.showUserRating'
)
Route.get('/video-rating/:uuid', 'VideoRatingController.getVideoRatingStats')

// user channel subscriptions
Route.post(
	'/subscription/:userId/:channel',
	'UserChannelSubscriptionController.saveUserChannelSubscription'
)

Route.post(
	'/blockchain/confirmation',
	'BlockchainController.getBlockchainConfirmationCode'
)
