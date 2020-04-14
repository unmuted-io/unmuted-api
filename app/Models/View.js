'use strict'

/** @type {typeof import('@adonisjs/lucid/src/Lucid/Model')} */
const Model = use('Model')

class View extends Model {
	user () {
		return this.hasMany('App/Models/User')
	}

	video () {
		return this.hasMany('App/Models/Video')
	}
}

module.exports = View
