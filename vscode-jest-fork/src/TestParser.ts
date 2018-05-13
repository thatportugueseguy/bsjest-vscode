import { IParseResults, parse as parseReason } from 'jest-editor-support'

export function getParser(filePath: string): Function {
  if (filePath) {
    return parseReason;
  }
}

export function parseTest(filePath: string): IParseResults {
  console.log("test");
  const parser = getParser(filePath)
  return parser(filePath)
}
