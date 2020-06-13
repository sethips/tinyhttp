import App from './src/index'
import logger from './src/helpers/logger'
import staticFolder from './src/helpers/static'

const app = new App()

app.all('/', (_, res) => res.send('<h1>Hello World</h1>'))

app.get('/:first/:second', (req, res) => {
  res.json({ URLParams: req.params, QueryParams: req.query })
})

app.use(staticFolder())

app.use(logger())

app.listen(3000)