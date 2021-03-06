/* global use */

'use strict'
const crypto = require('crypto')
const base32 = require('hi-base32')
const fs = require('fs')
const WebSocket = require('ws')
const AWS = require('aws-sdk')
const videoUtils = require('../../../utils/video')
const {
	getCreateJobJSON,
	getObjectsList,
	getS3ObjectPromise,
	multiTryS3Download,
	uploadThumbnailsToDstor,
	uploadVideoToDstor,
} = videoUtils

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
		console.log('MediaController onstructor being called')
		const { AWS_ID, AWS_SECRET, AWS_BUCKET_NAME } = process.env
		this.AWS_ID = AWS_ID
		this.AWS_SECRET = AWS_SECRET
		this.AWS_BUCKET_NAME = AWS_BUCKET_NAME
		console.log('in VideoController constructor')
		this.ws = new WebSocket('ws://localhost:9824')
		this.ws.isOpen = false
		this.ws.on('open', () => {
			console.log('controller websocket opened')
			this.ws.isOpen = true
		})

		this.ws.on('close', function close() {
			console.log('controller websocket disconnected')
		})

		this.ws.on('error', (error) => {
			console.log('controller websocket error: ', error)
		})

		this.ws.on('message', (data) => {
			if (data === 'in the browser right now') {
				this.ws.messages.forEach((element) => {
					this.ws.send(element)
				})
			}
		})
		this.ws.messages = []
		this.ws.sendJSON = (obj) => {
			if (this.ws.isOpen) {
				this.ws.send(JSON.stringify(obj))
			} else {
				this.ws.messages.push(JSON.stringify(obj))
			}
		}
	}

	async message({ request, response }) {
		const rawBody = request.raw()
		const body = JSON.parse(rawBody)
		const { Message } = body
		const { userMetadata, state } = JSON.parse(Message)
		const { rand, time } = userMetadata
		const video = await Video.findBy({ rand })
		const ongoingProcessedJson = JSON.parse(video.processed)
		const progressMap = {
			PROGRESSING: 'TRANSCODING_IN_PROGRESS',
			COMPLETED: 'TRANSCODING_COMPLETE',
		}

		if (state === 'COMPLETED') {
			if (ongoingProcessedJson.video.progress !== 'TRANSCODING_STARTED') return
			console.log('COMPLETED')

			const writePrefix = 'public/videos/processed/stream'
			if (ongoingProcessedJson.video.progress !== 'DOWNLOAD_COMPLETE') {
				ongoingProcessedJson.video.progress = progressMap[state]
				ongoingProcessedJson.video.files = {}
				ongoingProcessedJson.processing = true
				video.processed = JSON.stringify(ongoingProcessedJson)
				await video.save()
				// done transcoding
				const videoPrefix = `a/${video.user_id}/${time}-${rand}/400k`
				const inputBucketConfig = {
					Prefix: videoPrefix,
					Bucket: process.env.S3_PROCESSED_VIDEO_BUCKET,
				}
				const videoBucketObjects = await getObjectsList(inputBucketConfig)
				console.log('completed videoBucketObjects: ', videoBucketObjects)

				/////////////////////////
				const { Contents: videoContents } = videoBucketObjects
				const videoObjectsToGet = videoContents.map((file, index) => {
					const fileKey = file.Key.replace(videoPrefix, '')
					ongoingProcessedJson.video.files[file.Key] =
						'TRANSCODED_FILE_REGISTERED'
					return {
						file,
						fileKey,
						progress: false,
						index,
					}
				})
				ongoingProcessedJson.video.progress = 'TRANSCODED_FILES_REGISTERED'
				try {
					video.processed = JSON.stringify(ongoingProcessedJson)
					await video.save()
				} catch (err) {
					console.log('video save error: ', err)
				}
				console.log('videoObjectsToGet: ', videoObjectsToGet)

				fs.mkdirSync(
					`public/videos/processed/stream/${videoPrefix}`,
					{ recursive: true },
					(err) => {
						console.log('mkdir err: ', err)
					}
				)

				await multiTryS3Download(
					videoObjectsToGet,
					writePrefix,
					ongoingProcessedJson.video,
					process.env.S3_PROCESSED_VIDEO_BUCKET
				)
				video.processed = JSON.stringify(ongoingProcessedJson)
				await video.save()
				console.log('something')
			}

			if (
				ongoingProcessedJson.video.progress !== 'FILES_DSTOR_UPLOAD_COMPLETE'
			) {
				await uploadVideoToDstor(rand, ongoingProcessedJson)
				video.processed = JSON.stringify(ongoingProcessedJson)
				await video.save()
			}
			if (ongoingProcessedJson.thumbnails.progress !== 'DOWNLOADED') {
				const thumbnailPrefix = `a/${video.user_id}/${time}-${rand}`

				const thumbnailInputBucketConfig = {
					Prefix: thumbnailPrefix,
					Bucket: process.env.S3_THUMBNAILS_BUCKET,
				}
				const thumbnailBucketObjects = await getObjectsList(
					thumbnailInputBucketConfig
				)
				console.log(
					'completed thumbnailBucketObjects: ',
					thumbnailBucketObjects
				)

				/////////////////////////
				const { Contents: thumbnailContents } = thumbnailBucketObjects
				const thumbnailObjectsToGet = thumbnailContents.map((file, index) => {
					const fileKey = file.Key.replace(thumbnailPrefix, '')
					ongoingProcessedJson.thumbnails.files[file.Key] = 'FILE_REGISTERED'
					return {
						file,
						fileKey,
						progress: false,
						index,
					}
				})
				ongoingProcessedJson.thumbnails.progress = 'FILES_REGISTERED'
				try {
					video.processed = JSON.stringify(ongoingProcessedJson)
					await video.save()
				} catch (err) {
					console.log('video save error: ', err)
				}
				console.log('thumbnailObjectsToGet: ', thumbnailObjectsToGet)

				fs.mkdirSync(
					`public/videos/processed/stream/${thumbnailPrefix}/thumbnails`,
					{ recursive: true },
					(err) => {
						console.log('mkdir err: ', err)
					}
				)
				await multiTryS3Download(
					thumbnailObjectsToGet,
					writePrefix,
					ongoingProcessedJson.thumbnails,
					process.env.S3_THUMBNAILS_BUCKET
				)
				video.processed = JSON.stringify(ongoingProcessedJson)
				await video.save()
			}
			if (
				ongoingProcessedJson.thumbnails.progress !==
				'FILES_DSTOR_UPLOAD_COMPLETE'
			) {
				uploadThumbnailsToDstor(rand)
			}
			// now do thumbnails
		}
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
		const { description, title, username } = request.body
		const file = request.file('file')
		console.log('attached file: ', file)
		const userRows = await Database.table('users').where('username', username)
		const user = userRows[0]
		let rand = await crypto.randomBytes(8)
		// make a random string
		rand = base32.encode(rand).replace(/===/i, '')

		const time = new Date().getTime()
		// set the source filename
		const timeAndRand = `${time}-${rand}`
		const source = `${timeAndRand}.mp4`
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
		this.ws.sendJSON({ progress: 10 })
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

			const getObjectData = await getS3ObjectPromise(getObjectParams)
			console.log('getObjectData: ', getObjectData)
			this.ws.sendJSON({ progress: 20 })
			// create entry in db
			const ongoingProcessedJson = {
				video: { progress: 'UPLOADED' },
				thumbnails: {},
			}
			video = await Video.create({
				source,
				rand,
				duration: 0,
				user_id: user.id,
				description,
				title,
				processed: JSON.stringify(ongoingProcessedJson),
				hash: rand,
			})
			this.ws.sendJSON({ progress: 50 })
			console.log('video: ', video.toJSON())
			const newView = new View()
			newView.video_id = video.id
			newView.user_id = 1
			newView.last_position = 0
			await newView.save()
			this.ws.sendJSON({ progress: 60 })
			response.status(200).send({
				video,
			})
			this.ws.sendJSON({ progress: 100, rand })

			const createJobInput = getCreateJobJSON({
				userId: user.id,
				time,
				source,
				rand,
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
			ongoingProcessedJson.video = {
				progress: 'TRANSCODING_STARTED',
				files: {},
			}
			ongoingProcessedJson.thumbnails = {
				progress: 'NOT_STARTED',
				files: {},
			}
			video.processed = JSON.stringify(ongoingProcessedJson)
			await video.save()
		} catch (error) {
			console.log('S3 put error: ', error)
		}
	}
}

module.exports = MediaController
