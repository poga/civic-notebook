/* eslint-env browser */
const html = require('choo/html')
const css = require('sheetify')
const choo = require('choo')
const log = require('choo-log')
const reload = require('choo-reload')
const request = require('superagent')
const path = require('path')

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
}

function archiveView (state, emit) {
  var key = state.params.key
  var child = state.params.wildcard
  if (!child) child = '/'
  console.log(key, child)
  if (!state.archive.root) {
    emit('fetch-archive', key, child)
  } else if (state.archive.root !== child) {
    emit('readdir', child)
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
    <li class="pointer code lh-copy pl2 pv1 ba bl-0 bt-0 br-0 b--dotted b--black-30 ${f.isDir ? 'bg-black-05' : ''}" onclick=${onclick}>
      <span class="mr2">${f.isDir ? '📁' : '📄'}</span>
      ${f.name}
    </li>
  `

    function onclick () {
      var child = path.join(state.archive.root, f.name)
      if (f.isDir) {
        emit('pushState', `/archives/${key}/${child}`)
      } else {
        emit('pushState', `/notebooks/${key}/${child}`)
      }
    }
  }
}

function archiveStore (state, emitter) {
  if (typeof window === 'undefined') return
  state.archive = {}

  emitter.on('fetch-archive', (key, child) => {
    state.archive.root = '/'
    var ws = new WebSocket(`ws://localhost:3000/api/dats/${key}/events`)
    ws.onopen = () => {
      state.ws = ws
      emitter.emit('readdir', '/')
    }
    ws.onmessage = function (e) {
      console.log('websocket', e.data)
      var msg = JSON.parse(e.data)
      switch (msg.type) {
        case 'readdir':
          state.archive.files = msg.result
      }
      emitter.emit('render')
    }
  })

  emitter.on('readdir', name => {
    state.archive.root = name
    state.ws.send(JSON.stringify({type: 'readdir', params: state.archive.root}))
  })
}
