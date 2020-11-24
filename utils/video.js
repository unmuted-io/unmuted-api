const { DSTOR_API_URL } = process.env

const replaceM3u8Links = (input, hashes) => {
	let newString = input
	for (let i = 0; i < Object.keys(hashes).length; i++) {
		newString = newString.replace(
			`stream${i}.ts\n`,
			`${DSTOR_API_URL}/ipfs/${hashes[i]}\n`
		)
	}
	return newString
}

const getCreateJobJSON = ({ time, userId, source, rand }) => {
	const timeAndRand = `${time}-${rand}`
	return {
		Inputs: [
			{
				Key: `a/${userId}/${source}`,
				FrameRate: 'auto',
				Resolution: 'auto',
				AspectRatio: 'auto',
				Interlaced: 'auto',
				Container: 'auto',
			},
		],
		OutputKeyPrefix: `a/${userId}/${timeAndRand}`, // folders
		Outputs: [
			{
				Key: `/${timeAndRand}/${timeAndRand}-`, // folder and m3u8 name
				ThumbnailPattern: '',
				Rotate: 'auto',
				PresetId: '1351620000001-200050',
				SegmentDuration: '10',
			},
		],
		Playlists: [
			{
				Format: 'HLSv3',
				Name: `/${timeAndRand}_400K`, // folder and _____.m3u8?
				OutputKeys: [`/${timeAndRand}/${timeAndRand}-`], // folder and prefix before ________.ts
			},
		],
		UserMetadata: {
			test1: 'test1value',
		},
		PipelineId: '1605831556406-woiqni',
	}
}

module.exports = {
	replaceM3u8Links,
	getCreateJobJSON,
}
