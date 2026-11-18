// Shared by every source so the app can treat "could not draw" the same way
export class SourceUnreachable extends Error {
  constructor(message = 'The source did not answer', options) {
    super(message, options)
    this.name = 'SourceUnreachable'
  }
}
