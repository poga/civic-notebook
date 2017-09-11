const html = require('choo/html')
const css = require('sheetify')
const choo = require('choo')
const log = require('choo-log')
const reload = require('choo-reload')

css('tachyons')

var app = choo()
app.use(log())
app.use(reload())
app.route('/', main)

if (!module.parent) {
  app.mount('body')
} else {
  module.exports = app
}

function main () {
  return html`
    <body class="center tc vh-100 flex flex-column items-center justify-center">
      <header class="tc pv3-ns">
        <h1 class="f4 f2-ns fw6 mid-gray">Civic Notebook</h1>
        <h2 class="f6 gray fw2 ttu tracked">Share & Research Civic Data</h2>
      </header>
      <form class="pa4 black-80 w-100">
        <div class="measure tc center">
          <input id="name" class="input-reset ba b--black-20 pa2 mb2 db w-100 black-70" type="text" placeholder="Archive Key">
          <div class="pa2">
            <a class="f6 link dim ph3 pv2 mb2 dib white bg-black-70" href="#0">Open</a>
          </div>
        </div>
      </form>
    </body>
  `
}
