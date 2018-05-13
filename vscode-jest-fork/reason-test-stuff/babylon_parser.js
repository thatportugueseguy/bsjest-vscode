const { execSync } = require('child_process')

const parse = (exports.parse = file => {
  const result = {
    itBlocks: [],
    expects: [],
  }
  console.log('execSync bs-jest:' + execSync('pwd'))
  const data = execSync('migrate.byte ' + file)
  const lines = data.split('\n')
  for (let i = 0; i < lines.length; i += 3) {
    const startPosition = lines[i + 1].split(' ')
    const endPosition = lines[i + 2].split(' ')

    result.itBlocks.push({
      start: {
        line: startPosition[0],
        column: startPosition[1],
      },
      end: {
        line: endPosition[0],
        column: endPosition[1],
      },
      file: file,
    })
    if (line == '@') break
  }

  for (let i = 0; i < lines.length; i += 3) {
    const startPosition = lines[i].split(' ')
    const endPosition = lines[i + 1].split(' ')
    result.itBlocks.push({
      start: {
        line: startPosition[0],
        column: startPosition[1],
      },
      end: {
        line: endPosition[0],
        column: endPosition[1],
      },
    })
  }

  return result
})
