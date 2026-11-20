import { test } from 'node:test'
import assert from 'node:assert/strict'
import { languageNames, yearOf } from '../../src/js/data/text.js'

test('the performance year beats the composition year', () => {
  assert.equal(yearOf('Composition: 1885\nPerformance: 1991'), 1991)
  assert.equal(yearOf('Composition: 1885 Performance: 1991'), 1991)
  assert.equal(yearOf('Recorded 12 May 1978'), 1978)
})

test('upload dates are never the recording year', () => {
  assert.equal(yearOf('13 May 2010 (original upload date)'), undefined)
  assert.equal(yearOf('13 May 2010 (original upload date)\nRecorded: 1962'), 1962)
  assert.equal(yearOf('Uploaded: 2012'), undefined)
})

test('a composition-only year is not a recording year', () => {
  assert.equal(yearOf('Composition: 1885'), undefined)
})

test('unlabelled dates keep the first plausible year', () => {
  assert.equal(yearOf('1914-02'), 1914)
  assert.equal(yearOf('1927-1929'), 1927)
  assert.equal(yearOf('19270614'), 1927)
  assert.equal(yearOf('c. 1920'), 1920)
  assert.equal(yearOf('1066'), undefined)
  assert.equal(yearOf(['unknown', '1955']), 1955)
  assert.equal(yearOf(undefined), undefined)
})

test('language codes become readable names, unknown values stay as stated', () => {
  assert.deepEqual(languageNames('eng'), ['English'])
  assert.deepEqual(languageNames('English'), ['English'])
  assert.deepEqual(languageNames('per'), ['Persian'])
  assert.deepEqual(languageNames('Enga'), ['Enga'])
  assert.deepEqual(languageNames(['eng', 'cos']), ['English', 'Corsican'])
  assert.deepEqual(languageNames(['eng', 'English', 'en']), ['English'])
  assert.deepEqual(languageNames('eng; fre'), ['English', 'French'])
  assert.deepEqual(languageNames(undefined), [])
})
