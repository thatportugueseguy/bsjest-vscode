const { execSync } = require('child_process')

const parse = (exports.parse = file => {
  const result = {
    itBlocks: [],
    expects: [],
  }
  const data = execSync('./migrate.byte ' + file).toString()
  const lines = data.split('\n')
  let i = 0
  for (; i < lines.length; i += 3) {
    if (lines[i] == '@') break
    const startPosition = lines[i + 1].split(' ')
    const endPosition = lines[i + 2].split(' ')

    result.itBlocks.push({
      start: {
        line: parseInt(startPosition[0]),
        column: parseInt(startPosition[1]) + 1,
      },
      end: {
        line: parseInt(endPosition[0]),
        column: parseInt(endPosition[1]) + 1,
      },
      file: file,
      name: lines[i],
    })
  }
  for (i++; i + 2 < lines.length; i += 2) {
    const startPosition = lines[i].split(' ')
    const endPosition = lines[i + 1].split(' ')
    result.expects.push({
      file: file,
      start: {
        line: parseInt(startPosition[0]),
        column: parseInt(startPosition[1]) + 1,
      },
      end: {
        line: parseInt(endPosition[0]),
        column: parseInt(endPosition[1]) + 1,
      },
    })
  }

  return result
})
