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

// Route.resource('videos', 'VideoController')
Route.put('/videos/:id', 'VideoController.update').middleware('auth')
Route.delete('/videos/id', 'VideoController.destroy').middleware('auth')
Route.post('/videos', 'VideoController.store').middleware('auth')
Route.get('/videos', 'VideoController.index')
Route.get('/videos/:id', 'VideoController.show')


Route.post('/auth/register', 'AuthController.register')
Route.post('/auth/login', 'AuthController.login')
