/* global use */

'use strict'
const crypto = require('crypto')
const base32 = require('hi-base32')
const ffmpeg = require('fluent-ffmpeg')
const WebSocket = require('ws')
const VideoChatController = require('./VideoChatController')
const VideoChat = new VideoChatController() // instantiates websockets
const { spawn } = require('child_process')

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
			console.log(`controller received messgae: ${data}`)
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
			const cleanedFfmpegCommandArray = [
				'-ss',
				'1',
				'-i',
				`public/videos/${source}`,
				'-y',
				'-filter_complex',
				"scale=w='if(gt(a,1.5),360,trunc(240*a/2)*2)':h='if(lt(a,1.5),240,trunc(360/a/2)*2)'[size0];[size0]pad=w=360:h=240:x='if(gt(a,1.5),0,(360-iw)/2)':y='if(lt(a,1.5),0,(240-ih)/2)':color=black[out]",
				'-b:a',
				'128k',
				'-ac',
				'2',
				'-acodec',
				'libmp3lame',
				'-vcodec',
				'libx264',
				'-r',
				'30000/1001',
				`public/videos/processed/${source}`,
				'-map',
				'[out]',
				'-r',
				`${thumbnailRate}`,
				'-vframes',
				'16',
				'-start_number',
				'0.25',
				`public/images/videos/thumbnails/${sourceAndRand}-360x240-%d.png`,
				'-f',
				'hls',
				'-hls_time',
				'10',
				'-hls_playlist_type',
				'event',
				'stream/stream.m3u8'
			]
			const ffmpeg = spawn('ffmpeg', cleanedFfmpegCommandArray)

			ffmpeg.stdout.on('data', (data) => {
				console.log(`stdout: ${data}`)
			})
			ffmpeg.stderr.on('data', (data) => {
				const stringifiedData = data.toString()
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
				this.ws.send(85)

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
					video = await Video.create({
						source,
						rand,
						duration: Math.floor(duration),
						user_id: user.id,
						description,
						title,
						processed: 1
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
						video,
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
