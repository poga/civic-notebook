/* eslint-env browser */
const html = require('choo/html')
const css = require('sheetify')
const choo = require('choo')
const log = require('choo-log')
const reload = require('choo-reload')
const request = require('superagent')

css('tachyons')

var app = choo()
app.use(log())
app.use(reload())
app.route('/', mainView)
app.route('/archives/:key', archiveView)
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

  async function submit (e) {
    e.preventDefault()
    var key = document.querySelector('#archiveKey').value
    console.log(key)
    emit('pushState', `/archives/${key}`)
  }
}

function archiveView (state, emit) {
  var key = state.params.key
  if (!state.archive) emit('fetch-archive', key)
  console.log('state', state)

  return html`
    <body class="center tc">
      <div class="pa3 pa5-ns">
        <ul class="list pl0 center w-100 tl">
          ${state.archive ? state.archive.map(listItem) : ''}
        </ul>
      </div>
    </body>
  `
}

async function archiveStore (state, emitter) {
  if (typeof window === 'undefined') return
  state.archive = null

  emitter.on('fetch-archive', key => {
    var ws = new WebSocket(`ws://localhost:3000/api/dats/${key}/events`)
    ws.onmessage = function (e) {
      console.log('websocket', e.data)
      state.archive = JSON.parse(e.data)

      emitter.emit('render')
    }
  })
}

function listItem (name) {
  return html`<li class="lh-copy pl2 pv1 ba bl-0 bt-0 br-0 b--dotted b--black-30">${name}</li>`
}
