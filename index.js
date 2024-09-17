const readers = require('./url_to_markdown_readers.js')
const processor = require('./url_to_markdown_processor.js')
const validURL = require('@7c/validurl')
const express = require('express')
const rateLimit = require('express-rate-limit')
const JSDOM = require('jsdom').JSDOM
const port = process.env.PORT || 3100
const app = express()

const rateLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 5,
  message: 'Rate limit exceeded',
  headers: true,
})

app.use(rateLimiter)

app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
  })
)

function send_headers(res) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST')
  res.header('Access-Control-Expose-Headers', 'X-Title')
  res.header('Content-Type', 'text/markdown')
}

function read_url(url, res, inline_title, ignore_links) {
  reader = readers.reader_for_url(url)
  send_headers(res)
  reader.read_url(url, res, inline_title, ignore_links)
}

app.get('/', (req, res) => {
  const url = req.query.url
  const title = req.query.title
  const links = req.query.links
  let inline_title = false
  let ignore_links = false
  if (title) {
    inline_title = title === 'true'
  }
  if (links) {
    ignore_links = links === 'false'
  }
  if (url && validURL(url)) {
    read_url(url, res, inline_title, ignore_links)
  } else {
    res.status(400).send('Please specify a valid url query parameter')
  }
})

app.post('/', function (req, res) {
  const html = req.body.html
  const url = req.body.url
  const links = req.query.links
  const title = req.query.title
  let ignore_links = false
  let inline_title = false
  if (title) {
    inline_title = title === 'true'
  }
  if (links) {
    ignore_links = links === 'false'
  }
  if (readers.ignore_post(url)) {
    read_url(url, res, inline_title, ignore_links)
    return
  }
  if (!html) {
    res.status(400).send('Please provide a POST parameter called html')
  } else {
    try {
      let document = new JSDOM(html)
      let markdown = processor.process_dom(
        url,
        document,
        res,
        inline_title,
        ignore_links
      )
      send_headers(res)
      res.send(markdown)
    } catch (error) {
      res.status(400).send('Could not parse that document')
    }
  }
})

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
