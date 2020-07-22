/* global use */

'use strict'
const crypto = require('crypto')
const base32 = require('hi-base32')
const ffmpeg = require('fluent-ffmpeg')
const FormData = require('form-data')
const fs = require('fs')
const WebSocket = require('ws')
const axios = require('axios')
const VideoChatController = require('./VideoChatController')
const VideoChat = new VideoChatController() // instantiates websockets
const { spawn } = require('child_process')
const { getFfmpegCommand, getCustomStreamTemplate, replaceM3u8Links } = require('../../../utils/video')

// set namespace
const Video = use('App/Models/Video')
const Database = use('Database')
const View = use('App/Models/View')

class MediaController {
	constructor() {
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
		console.log('inside store')
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
		// move the file from temp to public folder
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
		// create the entry in the database
		let video
		let progress = 0
		// process the movie file
		// handle duplicates
		ffmpeg.ffprobe(`public/videos/${source}`, async (error, metadata) => {
			if (error) console.error('ffprobe error: ', error)
			// console.log('input metatdata: ', metadata)
			const { format } = metadata
			const { duration } = format

			let thumbnailRate = 1 // one per second
			if (duration < 7) {
				thumbnailRate = duration / 7
			}
			const totalFrames = duration * 30 // approximation
			// console.log('about to create ffmpeg')
			if (!fs.existsSync(`public/videos/processed/stream/${sourceAndRand}/`)){
				fs.mkdirSync(`public/videos/processed/stream/${sourceAndRand}/`)
			}
			let streamIterator = 0
			const path = `public/videos/processed/stream/${sourceAndRand}`
			const hashes = {}
			const cleanedFfmpegCommandArray = getFfmpegCommand(source, thumbnailRate, sourceAndRand)
			const ffmpeg = spawn('ffmpeg', cleanedFfmpegCommandArray)

			ffmpeg.stdout.on('data', (data) => {
				console.log(`stdout: ${data}`)
			})
			ffmpeg.stderr.on('data', async (data) => {
				console.log(`data: ${data}`)
				const stringifiedData = data.toString()
				const segmentSearchString = `Opening '${path}/stream${streamIterator + 1}.ts' for writing`

				if (stringifiedData.search(segmentSearchString) > -1) {
					console.log(`On streamIterator: ${streamIterator}`)
					const fileStream = fs.readFileSync(`${path}/stream${streamIterator}.ts`)
					const formData = new FormData()
					const formHeaders = formData.getHeaders()
					const boundaryKey = Math.random().toString(16)
					formData.append('file', fileStream, source)
					const dstorAddResponse = await axios({
						url: `${DSTOR_API_URL}/api/v0/add`,
						method: 'post',
						headers: {
							...formHeaders,
							Authorization: `Bearer ${DSTOR_ACCESS_TOKEN}`,
							'Content-Type': `multipart/form-data; boundary="${boundaryKey}"`
						},
						data: formData,
						maxContentLength: Infinity,
						maxBodyLength: Infinity
					})
					if (dstorAddResponse.statusText === 'OK') {
						const { Hash } = dstorAddResponse.data
						if (fs.existsSync(`${path}/customStream.m3u8`)) {
							const file = fs.readFileSync(`${path}/stream.m3u8`, { encoding: 'utf8'})
							const newString = replaceM3u8Links(file, hashes)
							fs.writeFileSync(`${path}/customStream.m3u8`, newString)
						} else {
							const template = getCustomStreamTemplate(Hash)
							fs.writeFileSync(`${path}/customStream.m3u8`, template)
						}
						hashes[streamIterator] = Hash
						console.log('Hash is: ', Hash)
						// console.log('streamIterator: ', streamIterator, ' Hashs is: ', Hash, ' and hashes: ', hashes)
						streamIterator++
					}
				}
				// console.error(`stderr: ${stringifiedData}`)
				const stringFirstPart = stringifiedData.substring(0,6)
				// console.log('stringFirstPart: ', stringFirstPart)
				if (stringFirstPart === 'frame=') {
					const dataArray = stringifiedData.replace(/ +(?= )/g,'').split(' ')
					// console.log('frames: ', dataArray[1])
					const frames = dataArray[1]
					progress = (frames / totalFrames) * 100
					console.log('progress: ', progress)
					if (progress < 100) {
						this.ws.send(progress * 0.8)
					}
				}
			})
			ffmpeg.on('close', async (code) => {
				console.log(`child process exited with code ${code}`)
				if (code !== 0) {
					console.log('error: ', code)
					return response.status(500).send()
				}
				this.ws.send(82)

				const file = fs.readFileSync(`${path}/stream.m3u8`, { encoding: 'utf8'})
				const newString = replaceM3u8Links(file, hashes)
				fs.writeFileSync(`${path}/customStream.m3u8`, newString)

				this.ws.send(87)

				const ffprobe1 = spawn('ffprobe', [
					'-print_format',
					'json',
					'-show_streams',
					`public/videos/processed/${source}`]
				)

				ffprobe1.stdout.on('data', async (data) => {
					const stringifiedData = data.toString()

					console.log(`stdout: ${stringifiedData}`)
					const ouput = JSON.parse(stringifiedData)
					const { streams } = ouput
					const h264 = streams.find(stream => stream.codec_name === 'h264')
					if (!h264) return response.status(500).send()
					const { duration } = h264
					this.ws.send(90)
					// should check to make sure not duplicate

					const fileStream = fs.readFileSync(`public/videos/processed/stream/${sourceAndRand}/customStream.m3u8`)
					const formData = new FormData()
					const formHeaders = formData.getHeaders()
					const boundaryKey = Math.random().toString(16)
					formData.append('file', fileStream, source)
					const dstorAddResponse = await axios({
						url: `${DSTOR_API_URL}/api/v0/add`,
						method: 'post',
						headers: {
							...formHeaders,
							Authorization: `Bearer ${DSTOR_ACCESS_TOKEN}`,
							'Content-Type': `multipart/form-data; boundary="${boundaryKey}"`
						},
						data: formData
					})
					const { Hash } = dstorAddResponse.data
					video = await Video.create({
						source,
						rand,
						duration: Math.floor(duration),
						user_id: user.id,
						description,
						title,
						processed: 1,
						hash: Hash
					})
					this.ws.send(95)
					// create a default user 1 view entry or some joins will break
					const newView = new View()
					newView.video_id = video.id
					newView.user_id = 1
					newView.last_position = 0
					await newView.save()
					this.ws.send(100)
					this.ws.send('complete: ', + rand)
					response.status(200).send({
						video
					})
				})

				ffprobe1.stderr.on('data', (data) => {
					console.error(`stderr: ${data.toString()}`)
				})

				ffprobe1.on('close', (code) => {
					console.log(`child process exited with code ${code}`)
				})
			})
			response.send(rand)
		})
	}
}

module.exports = MediaController
