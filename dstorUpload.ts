const FormData = require('form-data')
const fetch = require('node-fetch')
const fs = require('fs')

const url = new URL('http://127.0.0.1:8080/api/v0/add')
const access_token =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuIjoiYWRtaW4iLCJlIjoiYWRtaW5AZHN0b3IuY29tIiwiZCI6dHJ1ZSwibyI6dHJ1ZSwicyI6dHJ1ZSwiaWF0IjoxNTk1Mjc2MDM3LCJhdWQiOiJkc3Rvci5jbG91ZCIsImlzcyI6ImRzdG9yLmNsb3VkIiwic3ViIjoiYWVhMzAxYzYtYmZmNy00ZDg4LTkzYzAtNGM4MjczN2RkYjliIn0.rZ4tZd4Iz5v-kWbyLIp10UBDbilmJN99DybyZnrMSJU'

const main = async () => {
	try {
		const file = fs.readFileSync(
			'public/videos/processed/1589262666877-BZ67KGKYI557G.mp4'
		)
		console.log('file: ', file)
		// const formData = {
		// 	file,
		// 	fileName: '1589262666877-BZ67KGKYI557G.mp4',
		// }
		const formData = new FormData()
		formData.append('file', file, '1589262666877-BZ67KGKYI557G.mp4' )
		const formHeaders = formData.getHeaders()
		console.log('formData: ', formData)
		const response = await fetch(url, {
			method: 'post',
			headers: {
				...formHeaders,
				Authorization: `Bearer ${access_token}`
			},
			data: formData,
			formData,
		})
		console.log('response: ', response)
	} catch (error) {
		console.log('error: ', error)
	}
}

main()