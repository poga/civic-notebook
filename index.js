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
const encoding = require('dat-encoding')
const cors = require('cors')

const safe = fn => (req, res, next) => { Promise.resolve(fn(req, res, next)).catch(next) }
const sleep = n => new Promise(resolve => setTimeout(resolve, n))

const datStorage = path.join(shell.pwd().toString(), 'dats')
const notebookStorage = path.join(shell.pwd().toString(), 'notebooks')

const dats = {}

var app = express()
app.use(cors())
app.use(express.static('assets'))
app.use(bodyParser.json())

// For now we only support single dat archive per process.
// client should use this API to know whether an archive is already loaded
app.get('/api/dats', safe(async function (req, res) {
  if (Object.keys(dats).length > 0) return res.json({result: Object.keys(dats)[0]})

  res.json({result: false})
}))

app.get('/api/dats/:key/*', safe(async function (req, res) {
  var key = encoding.decode(req.params.key).toString('hex')
  if (!dats[key]) dats[key] = await initDat(key)

  var archive = dats[key].dat.archive
  var result = await readdir(path.join('/', req.params[0]))

  res.json({result})

  async function readdir (root) {
    let readdir = promisify(archive.readdir, archive)
    let stat = promisify(archive.stat, archive)
    var files = await readdir(root)
    var ret = []
    for (var i = 0; i < files.length; i++) {
      var f = files[i]

      var st = await stat(path.join(root, f))
      ret.push({name: f, isDir: st.isDirectory()})
    }
    return ret
  }
}))

app.post('/api/notebooks', safe(async function (req, res) {
  var key = req.body.key
  var file = req.body.file
  console.log(key, file)
  if (!dats[key]) dats[key] = await initDat(key)

  await initNotebook(key, file)
  await sleep(3000)
  res.json({status: 'ok'})
}))

app.use(function (err, req, res, next) {
  console.error(err)
  res.json({error: err.message})
})

app.listen(3000, () => console.log('listening 3000'))

async function initDat (key) {
  var p = path.join(datStorage, key)
  await mkdirp(p)
  var dat = await Dat(p, {key, sparse: true})
  var bus = nanobus()

  bus.on('*', console.log)

  var network = dat.joinNetwork()
  network.on('listening', () => bus.emit('listening'))
  network.on('connection', (conn, info) => bus.emit('connection', info))

  var stat = dat.trackStats()
  stat.on('update', () => bus.emit('stat', stat.get()))

  return {dat, bus}
}

async function initNotebook (key, file) {
  if (dats[key].notebook) return
  var rs = dats[key].dat.archive.createReadStream(file)
  var to = path.join(notebookStorage, key)
  await mkdirp(to)
  await pump(rs, fs.createWriteStream(path.join(to, file)))

  var stop = startJupyter(to, key)
  dats[key].notebook = true
  process.once('SIGINT', function () {
    console.log('exit')
    stop()
    process.exit()
  })

  function startJupyter (dir, key) {
    var out = shell.exec(`docker run -d -p 8888:8888 -v ${dir}:/home/jovyan jupyter/datascience-notebook start-notebook.sh --NotebookApp.token=''`)
    var jupyterID = out.stdout
    dats[key].jupyterID = jupyterID

    return function () {
      console.log('stopping', jupyterID)
      shell.exec(`docker stop ${jupyterID}`, {silent: true})
      shell.exec(`docker rm ${jupyterID}`, {silent: true})
    }
  }
}
