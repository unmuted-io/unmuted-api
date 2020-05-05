'use strict'

module.exports = {
	json: {
		limit: '50mb',
		strict: true,
		types: [
			'application/json',
			'application/json-patch+json',
			'application/vnd.api+json',
			'application/csp-report'
		]
	},
	raw: {
		types: [
			'text/*'
		]
	},
	form: {
		types: [
			'application/x-www-form-urlencoded'
		],
		limit: '50mb',
		maxFieldSize: '50mb'
	},
	files: {
		types: [
			'multipart/form-data'
		],
		maxFieldSize: '50mb',
		maxSize: '50mb',
		limit: '50mb',
		autoProcess: true,
		processManually: []
	}
}
