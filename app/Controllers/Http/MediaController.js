/* global use */

'use strict'
const crypto = require('crypto')
const base32 = require('hi-base32')
const FormData = require('form-data')
const fs = require('fs')
const WebSocket = require('ws')
const ffmpeg = require('fluent-ffmpeg')
const axios = require('axios')
const VideoChatController = require('./VideoChatController')
const VideoChat = new VideoChatController() // instantiates websockets
const AWS = require('aws-sdk')
const CronJob = require('cron').CronJob
const utils = require('../../../utils/video')
const { getCreateJobJSON } = utils

// Use bluebird implementation of Promise
if (typeof Promise === 'undefined') {
	console.log('using bluebird')
	AWS.config.setPromisesDependency(require('bluebird'))
}

const s3 = new AWS.S3({
	accessKeyId: process.env.AWS_KEY,
	secretAccessKey: process.env.AWS_SECRET,
})

const transcoder = new AWS.ElasticTranscoder({ region: process.env.S3_REGION })

// set namespace
const Video = use('App/Models/Video')
const Database = use('Database')
const View = use('App/Models/View')

class MediaController {
	constructor() {
		const { AWS_ID, AWS_SECRET, AWS_BUCKET_NAME } = process.env
		this.AWS_ID = AWS_ID
		this.AWS_SECRET = AWS_SECRET
		this.AWS_BUCKET_NAME = AWS_BUCKET_NAME
		this.cronIterator = 0
		console.log('in VideoController constructor')
		this.ws = new WebSocket('ws://localhost:9824')
		this.ws.on('open', () => {
			console.log('controller connected')
		})

		this.ws.on('close', function close() {
			console.log('controller disconnected')
		})

		this.ws.on('error', (error) => {
			console.log('controller ereror: ', error)
		})

		this.ws.on('message', (data) => {
			// console.log(`controller received messgae: ${data}`)
		})

		this.job = new CronJob(
			'1 * * * * *',
			() => {
				this.cron()
			},
			null,
			true,
			'America/Los_Angeles'
		)
		this.job.start()
	}

	async cron() {
		this.cronIterator++
		console.log(this.cronIterator)
	}

	/**
	 * Create/save a new video.
	 * POST videos
	 *
	 * @param {object} ctx
	 * @param {Request} ctx.request
	 * @param {Response} ctx.response
	 */

	async store({ request, response }) {
		const { DSTOR_ACCESS_TOKEN, DSTOR_API_URL } = process.env
		const { description, title, username } = request.body
		const file = request.file('file')
		const userRows = await Database.table('users').where('username', username)
		const user = userRows[0]
		let rand = await crypto.randomBytes(8)
		// make a random string
		rand = base32.encode(rand).replace(/===/i, '')

		const time = new Date().getTime()
		// set the source filename
		const sourceAndRand = `${time}-${rand}`
		const source = `${sourceAndRand}.mp4`
		console.log('file: ', file)
		// move the file from temp to public folder
		console.log('source: ', source)
		await file.move('public/videos', {
			name: source,
			overwrite: false,
			size: '2gb',
			types: ['video'],
		})
		if (!file.moved()) {
			response.status(500).send({
				message:
					'There was an error uploading your video. Please try again later.',
			})
		}
		this.ws.send(10)
		// create the entry in the database
		let video
		let progress = 0

		try {
			const fileStream = fs.readFileSync(`public/videos/${source}`)
			const params = {
				Bucket: process.env.S3_BUCKET,
				Key: `a/${user.id}/${source}`,
				Body: fileStream,
			}

			const putFile = () => {
				return new Promise((resolve, reject) => {
					s3.putObject(params, (err, data) => {
						if (err) reject(err)
						resolve(data)
					})
				})
			}

			const data = await putFile()
			console.log('putFile data: ', data)

			const getObjectParams = {
				Bucket: process.env.S3_BUCKET,
				Key: `a/${user.id}/${source}`,
			}

			const getObject = () => {
				return new Promise((resolve, reject) => {
					s3.getObject(getObjectParams, (err, data) => {
						if (err) reject(err)
						resolve(data)
					})
				})
			}

			const getObjectData = await getObject()
			console.log('getObjectData: ', getObjectData)
			this.ws.send(20)
			// create entry in db
			video = await Video.create({
				source,
				rand,
				duration: 0,
				user_id: user.id,
				description,
				title,
				processed: 0.1,
				hash: rand,
			})
			this.ws.send(50)
			console.log('video: ', video.toJSON())
			const newView = new View()
			newView.video_id = video.id
			newView.user_id = 1
			newView.last_position = 0
			await newView.save()
			this.ws.send(60)
			this.ws.send('complete: ', rand)
			response.status(200).send({
				video,
			})

			response.send(rand)
			const createJobInput = getCreateJobJSON({
				userId: user.id,
				time,
				source,
			})

			const createJob = () => {
				return new Promise((resolve, reject) => {
					transcoder.createJob(createJobInput, (err, data) => {
						if (err) reject(err)
						resolve(data)
					})
				})
			}

			await createJob()
			video.processed = 0.7
			await video.save()
		} catch (error) {
			console.log('S3 put error: ', error)
		}
	}
}

module.exports = MediaController
