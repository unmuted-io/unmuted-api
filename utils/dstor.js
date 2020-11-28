const FormData = require('form-data')
const axios = require('axios')
const { DSTOR_ACCESS_TOKEN, DSTOR_API_URL } = process.env

const uploadToDstor = async (fileStream, fileName, filePath) => {
	const formData = new FormData()
	const formHeaders = formData.getHeaders()
	const boundaryKey = Math.random().toString(16)
	formData.append('file', fileStream, fileName)
	try {
		const dstorAddResponse = await axios({
			url: `${DSTOR_API_URL}/api/v0/add`,
			method: 'post',
			headers: {
				...formHeaders,
				'x-dstor-folder-path': filePath,
				Authorization: `Bearer ${DSTOR_ACCESS_TOKEN}`,
				'Content-Type': `multipart/form-data; boundary="${boundaryKey}"`,
			},
			data: formData,
		})
		const { Hash } = dstorAddResponse.data
		return Hash
	} catch (err) {
		throw new Error(err)
	}
}

module.exports = {
	uploadToDstor,
}
