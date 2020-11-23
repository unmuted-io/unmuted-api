'use strict'

/** @type {typeof import('@adonisjs/lucid/src/Lucid/Model')} */
const Model = use('Model')

class Video extends Model {
	// this clause does not appear to be working
	static get hidden() {
		return []
	}

	user() {
		return this.belongsTo('App/Models/User')
	}

	view() {
		return this.hasMany('App/Models/View')
	}
}

module.exports = Video
