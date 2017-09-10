const shell = require('shelljs')
const express = require('express')
const promisify = require('es6-promisify')
const Dat = promisify(require('dat-node'))
const bodyParser = require('body-parser')
const path = require('path')
const nanobus = require('nanobus')
const fs = require('fs')
const pump = promisify(require('pump'))
const mkdirp = promisify(require('mkdirp'))

const safe = fn => (req, res, next) => { Promise.resolve(fn(req, res, next)).catch(next) }

var app = express()
require('express-ws')(app)
app.use(express.static('public'))
app.use(bodyParser.json())

const datStorage = path.join(shell.pwd().toString(), 'dats')
const notebookStorage = path.join(shell.pwd().toString(), 'notebooks')

const dats = {}

app.post('/api/v1/dats', safe(async function (req, res) {
  // TODO: need to escape key
  var key = req.body.key
  dats[key] = await initDat(key)
  res.json({status: 'ok'})
}))

app.ws('/api/v1/data/:key/events', safe(async function (ws, req) {
  var bus = dats[req.params.key].bus
  bus.on('*', (event, data) => {
    ws.send({event, data})
  })
}))

app.post('/api/v1/notebooks', safe(async function (req, res) {
  var key = req.body.key
  var file = req.body.file
  await initNotebok(key, file)
  res.json({status: 'ok'})
}))

app.listen(8080, function () { console.log('listening 8080') })

function startJupyter (dir) {
  shell.exec(`docker run -p 8888:8888 -v ${dir}:/home/jovyan/work jupyter/datascience-notebook start-notebook.sh --NotebookApp.token=''`, {async: true})

  return function () {
    var id = shell.exec('docker ps -a -q --filter ancestor=jupyter/datascience-notebook --format="{{.ID}}"')
    console.log('stopping', id.toString())
    shell.exec(`docker stop ${id}`)
    shell.exec(`docker rm ${id}`)
  }
}

async function initDat (key) {
  var p = path.join(datStorage, key)
  await mkdirp(p)
  var dat = await Dat(p, {key, sparse: true})
  var bus = nanobus()

  var network = dat.joinNetwork()
  network.on('listening', () => bus.emit('listening'))
  network.on('connection', (conn, info) => bus.emit('connection', conn, info))

  var stat = dat.trackStats()
  stat.on('update', () => bus.emit('update', stat.get()))

  dat.archive.readdir('/', (err, files) => {
    if (err) return bus.emit('error', err)
    bus.emit('index', files)
  })

  return {dat, bus}
}

async function initNotebok (key, file) {
  var rs = dats[key].dat.archive.createReadStream(file)
  var to = path.join(notebookStorage, key)
  await mkdirp(to)
  await pump(rs, fs.createWriteStream(path.join(to, file)))

  var stop = startJupyter(to)
  process.on('SIGINT', function () {
    console.log('exit')
    stop()
  })
}
