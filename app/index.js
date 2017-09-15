/* eslint-env browser */
const html = require('choo/html')
const css = require('sheetify')
const choo = require('choo')
const log = require('choo-log')
const reload = require('choo-reload')
const request = require('superagent')
const path = require('path')

const API_HOST = 'http://localhost:3000'

css('tachyons')

var app = choo()
app.use(log())
app.use(reload())
app.route('/', mainView)
app.route('/archives/:key', archiveView)
app.route('/archives/:key/*', archiveView)

app.use(archiveStore)

if (!module.parent) {
  app.mount('body')
} else {
  module.exports = app
}

function mainView (state, emit) {
  checkArchiveLoaded()

  return html`
    <body class="center tc vh-100 flex flex-column items-center justify-center">
      <header class="tc pv3-ns">
        <h1 class="f4 f2-ns fw6 mid-gray">Civic Notebook</h1>
        <h2 class="f6 gray fw2 ttu tracked">Share & Research Civic Data</h2>
      </header>
      <form class="pa4 black-80 w-100" onsubmit=${submit}>
        <div class="measure tc center">
          <input id="archiveKey" class="input-reset ba b--black-20 tc pa2 mb2 db w-100 black-70" type="text">
          <div class="pa2">
            <a class="f6 link dim ph3 pv2 mb2 dib white bg-black-70" href="#" onclick=${submit}>Get Started</a>
          </div>
        </div>
      </form>
    </body>
  `

  function submit (e) {
    e.preventDefault()
    var key = document.querySelector('#archiveKey').value
    emit('pushState', `/archives/${key}`)
  }

  function checkArchiveLoaded () {
    request
      .get(`${API_HOST}/api/dats`)
      .end((err, res) => {
        if (err) throw err

        if (res.body.result) {
          emit('pushState', `/archives/${res.body.result}`)
        }
      })
  }
}

function archiveView (state, emit) {
  var key = state.params.key
  var child = state.params.wildcard
  if (!child) child = '/'
  console.log(key, child)
  console.log(state)
  if (!state.archive.root || state.archive.root !== child) {
    emit('readdir', {key, child})
  }

  return html`
    <body class="center tc">
      <div class="pa3 pa5-ns">
        <div class="pl2 w-100 tl">${state.archive.root}</div>
        <ul class="list pl0 center w-100 tl">
          ${(state.archive && state.archive.files) ? state.archive.files.sort((x, y) => y.isDir - x.isDir).map(listItem) : ''}
        </ul>
      </div>
    </body>
  `
  function listItem (f) {
    return html`
    <li class="pointer code lh-copy pl2 pv1 hover-yellow ${f.isDir ? 'bg-black-05' : ''}" onclick=${onclick}>
      <span class="mr2">${f.isDir ? '📁' : '📄'}</span>
      ${f.name}
    </li>
  `

    function onclick () {
      var child = path.join(state.archive.root, f.name)
      if (f.isDir) {
        emit('pushState', `/archives/${key}/${child}`)
      } else {
        request
          .post(`${API_HOST}/api/notebooks`)
          .send({key, file: child})
          .end((err, res) => {
            if (err) throw err
            console.log(res.body)
            window.open('http://localhost:8888', '_blank')
          })
      }
    }
  }
}

function archiveStore (state, emitter) {
  state.archive = {}
  if (typeof window === 'undefined') return
  console.log('init archive store', state)

  emitter.on('readdir', ({key, child}) => {
    state.archive.root = child
    state.archive.key = key
    request
      .get(`${API_HOST}/api/dats/${key}/${child}`)
      .end((err, res) => {
        if (err) throw err
        console.log(res.body.result)
        state.archive.files = res.body.result
        emitter.emit('render')
      })
  })
}
