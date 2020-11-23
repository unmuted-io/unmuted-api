const CronJob = require('cron').CronJob

// set namespace
const Video = use('App/Models/Video')
const Database = use('Database')
const View = use('App/Models/View')

var job = new CronJob(
	'* * * * * *',
	function () {
		console.log('You will see this message every second')
	},
	null,
	true,
	'America/Los_Angeles'
)
job.start()
